import { sendCourseToCourseBuilder } from '../../infrastructure/courseBuilderClient/courseBuilderClient.js';
import { updateCourseStatusInDirectory } from '../../infrastructure/directoryClient/directoryClient.js';
import { logger } from '../../infrastructure/logging/Logger.js';

/**
 * Publish Course Use Case
 * 
 * ⚠️ IMPORTANT: We do NOT publish the course here.
 * We ONLY transfer it to Course Builder, which handles final publishing and visibility.
 * 
 * Validation Requirements:
 * - Every topic has a selected template
 * - All required content formats (based on format_order) are fully generated
 * - A DevLab exercise exists for the topic, if that exercise format is required
 * - No topic is missing content
 * - No content is empty or pending generation
 */
export class PublishCourseUseCase {
  constructor({ courseRepository, topicRepository, contentRepository, templateRepository, exerciseRepository }) {
    this.courseRepository = courseRepository;
    this.topicRepository = topicRepository;
    this.contentRepository = contentRepository;
    this.templateRepository = templateRepository;
    this.exerciseRepository = exerciseRepository;
  }

  /**
   * Validate course before transfer to Course Builder
   * @param {number} courseId - Course ID
   * @returns {Promise<{valid: boolean, errors: Array<{topic: string, issue: string}>}>}
   */
  async validateCourse(courseId) {
    const errors = [];

    // Get course
    const course = await this.courseRepository.findById(courseId);
    if (!course) {
      throw new Error('Course not found');
    }

    // Get all topics for this course
    const topics = await this.topicRepository.findByCourseId(courseId);

    if (!topics || topics.length === 0) {
      errors.push({
        topic: 'Course',
        issue: 'Course has no lessons/topics. Add at least one lesson before transferring.',
      });
      return { valid: false, errors };
    }

    // Validate each topic
    for (const topic of topics) {
      // 1. Check if template is selected
      if (!topic.template_id) {
        errors.push({
          topic: topic.topic_name || `Topic ID ${topic.topic_id}`,
          issue: 'A template has not been selected for this lesson',
        });
        continue; // Skip other validations for this topic
      }

      // Get template to check format_order
      const template = await this.templateRepository.findById(topic.template_id);
      if (!template) {
        errors.push({
          topic: topic.topic_name || `Topic ID ${topic.topic_id}`,
          issue: 'Selected template not found',
        });
        continue;
      }

      // Get format_order from template
      const formatOrder = template.format_order || [];
      if (!Array.isArray(formatOrder) || formatOrder.length === 0) {
        errors.push({
          topic: topic.topic_name || `Topic ID ${topic.topic_id}`,
          issue: 'Template has no format order defined',
        });
        continue;
      }

      // 2. Get all content for this topic
      const contents = await this.contentRepository.findAllByTopicId(topic.topic_id);

      // Map content by type name
      const contentByType = {};
      const typeIds = contents.map(c => c.content_type_id).filter(id => typeof id === 'number');
      if (typeIds.length > 0) {
        const typeNameMap = await this.contentRepository.getContentTypeNamesByIds(typeIds);
        contents.forEach(content => {
          const typeId = content.content_type_id;
          const typeName = typeof typeId === 'string' ? typeId : typeNameMap.get(typeId) || typeId;
          const normalizedTypeName = String(typeName).trim();
          
          // Map template format names to database type names
          if (normalizedTypeName === 'text_audio' || normalizedTypeName === 'text') {
            contentByType['text'] = content;
            contentByType['audio'] = content; // Audio is usually part of text_audio
          } else {
            contentByType[normalizedTypeName] = content;
          }
        });
      }

      // 3. Validate required formats exist
      const formatNameToDbName = {
        'text': 'text_audio',
        'code': 'code',
        'presentation': 'presentation',
        'audio': 'text_audio',
        'mind_map': 'mind_map',
        'avatar_video': 'avatar_video',
      };

      for (const formatName of formatOrder) {
        const dbTypeName = formatNameToDbName[formatName] || formatName;
        const content = contentByType[formatName] || contentByType[dbTypeName];

        if (!content) {
          errors.push({
            topic: topic.topic_name || `Topic ID ${topic.topic_id}`,
            issue: `Required format '${formatName}' has not been generated for this lesson`,
          });
          continue;
        }

        // 4. Check if content is empty or failed
        const contentData = typeof content.content_data === 'string' 
          ? JSON.parse(content.content_data) 
          : content.content_data || {};

        // Check for failed status (for avatar_video, check if videoUrl is missing)
        if (content.content_type_id === 6) { // avatar_video
          if (!contentData.videoUrl || contentData.error) {
            errors.push({
              topic: topic.topic_name || `Topic ID ${topic.topic_id}`,
              issue: `Avatar video generation failed or is incomplete for format '${formatName}'`,
            });
          }
        } else if (contentData.status === 'failed') {
          errors.push({
            topic: topic.topic_name || `Topic ID ${topic.topic_id}`,
            issue: `Content generation failed for format '${formatName}'`,
          });
        }

        // Check if content is empty
        const isEmpty = this.isContentEmpty(contentData, formatName);
        if (isEmpty) {
          errors.push({
            topic: topic.topic_name || `Topic ID ${topic.topic_id}`,
            issue: `Content for format '${formatName}' is empty or incomplete`,
          });
        }
      }

      // 5. Check DevLab exercises (stored in topics.devlab_exercises JSONB field)
      // devlab_exercises can be: null, array, or object with { html, questions, metadata }
      const hasValidExercises = (exercises) => {
        if (!exercises) return false;
        
        // If it's a string, try to parse it
        if (typeof exercises === 'string') {
          try {
            const parsed = JSON.parse(exercises);
            return hasValidExercises(parsed);
          } catch {
            // If parsing fails, check if string is not empty
            return exercises.trim().length > 0;
          }
        }
        
        // If it's an array, check if it has items
        if (Array.isArray(exercises)) {
          return exercises.length > 0;
        }
        
        // If it's an object, check the structure: { html: "...", questions: [...], metadata: {...} }
        if (typeof exercises === 'object') {
          // Check if it has questions array with at least one question
          if (exercises.questions && Array.isArray(exercises.questions) && exercises.questions.length > 0) {
            return true;
          }
          // Check if it has html content
          if (exercises.html && typeof exercises.html === 'string' && exercises.html.trim().length > 0) {
            return true;
          }
          // Fallback: check if object has any meaningful keys (not just metadata)
          const keys = Object.keys(exercises);
          return keys.length > 0 && keys.some(key => key !== 'metadata');
        }
        
        return false;
      };
      
      const exercises = topic.devlab_exercises;
      if (!hasValidExercises(exercises)) {
        errors.push({
          topic: topic.topic_name || `Topic ID ${topic.topic_id}`,
          issue: 'DevLab exercises are missing or invalid',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if content data is empty
   * @param {Object} contentData - Content data
   * @param {string} formatName - Format name
   * @returns {boolean} True if content is empty
   */
  isContentEmpty(contentData, formatName) {
    if (!contentData || typeof contentData !== 'object') {
      return true;
    }

    switch (formatName) {
      case 'text':
      case 'audio':
        return !contentData.text || contentData.text.trim().length === 0;
      case 'code':
        return !contentData.code || contentData.code.trim().length === 0;
      case 'presentation':
        return !contentData.presentationUrl && !contentData.fileUrl;
      case 'mind_map':
        return !contentData.nodes || !Array.isArray(contentData.nodes) || contentData.nodes.length === 0;
      case 'avatar_video':
        return !contentData.videoUrl;
      default:
        return Object.keys(contentData).length === 0;
    }
  }

  /**
   * Build course object for Course Builder
   * @param {number} courseId - Course ID
   * @returns {Promise<Object>} Course object ready for Course Builder
   */
  async buildCourseObject(courseId) {
    const course = await this.courseRepository.findById(courseId);
    if (!course) {
      throw new Error('Course not found');
    }

    const topics = await this.topicRepository.findByCourseId(courseId);

    // Build topics array with contents
    const topicsData = [];
    for (const topic of topics) {
      const template = await this.templateRepository.findById(topic.template_id);
      const contents = await this.contentRepository.findAllByTopicId(topic.topic_id);
      
      // Get devlab_exercises from topic (stored in topics.devlab_exercises JSONB field)
      // devlab_exercises can be: null, array, or object with { html, questions, metadata }
      let devlabExercises = topic.devlab_exercises || null;
      
      // Convert to string format if needed
      let devlabExercisesString = '';
      if (devlabExercises) {
        if (typeof devlabExercises === 'string') {
          // Already a string
          devlabExercisesString = devlabExercises;
        } else if (typeof devlabExercises === 'object') {
          // Convert object/array to JSON string
          devlabExercisesString = JSON.stringify(devlabExercises);
        }
      }

      // Get content type names mapping
      const contentTypeIds = contents.map(c => c.content_type_id).filter(id => typeof id === 'number');
      const typeNameMap = contentTypeIds.length > 0
        ? await this.contentRepository.getContentTypeNamesByIds(contentTypeIds)
        : new Map();

      // Map content to Course Builder format
      const contentsData = contents.map(content => {
        const contentData = typeof content.content_data === 'string'
          ? JSON.parse(content.content_data)
          : content.content_data || {};

        // Get content type name from map or fallback
        let contentType = 'unknown';
        if (typeof content.content_type_id === 'number') {
          const typeName = typeNameMap.get(content.content_type_id);
          contentType = typeName ? String(typeName).trim() : this.getContentTypeName(content.content_type_id);
        } else {
          contentType = String(content.content_type_id).trim();
        }

        // Map database type names to template format names
        const dbToTemplateMap = {
          'text_audio': 'text_audio',
          'code': 'code',
          'presentation': 'presentation',
          'audio': 'text_audio',
          'mind_map': 'mind_map',
          'avatar_video': 'avatar_video',
        };
        contentType = dbToTemplateMap[contentType] || contentType;

        return {
          content_id: String(content.content_id),
          content_type: contentType,
          content_data: contentData,
        };
      });

      topicsData.push({
        topic_id: String(topic.topic_id),
        topic_name: topic.topic_name || '',
        topic_description: topic.description || '',
        topic_language: topic.language || 'en',
        template_id: String(topic.template_id),
        format_order: template?.format_order || [],
        contents: contentsData,
        devlab_exercises: devlabExercisesString,
      });
    }

    return {
      course_id: String(course.course_id),
      course_name: course.course_name || '',
      course_description: course.description || '',
      course_language: course.language || 'en',
      trainer_id: course.trainer_id || '',
      trainer_name: course.trainer_id || '', // TODO: Get trainer name from auth
      topics: topicsData,
    };
  }

  /**
   * Get content type name from ID
   * @param {number} typeId - Content type ID
   * @returns {string} Content type name
   */
  getContentTypeName(typeId) {
    const typeMap = {
      1: 'text_audio',
      2: 'code',
      3: 'presentation',
      4: 'audio',
      5: 'mind_map',
      6: 'avatar_video',
    };
    return typeMap[typeId] || 'unknown';
  }

  /**
   * Execute publish course (transfer to Course Builder)
   * @param {number} courseId - Course ID
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async execute(courseId) {
    // Validate course
    const validation = await this.validateCourse(courseId);
    
    if (!validation.valid) {
      const errorMessages = validation.errors.map(err => 
        `Cannot transfer the course:\n${err.issue} for the lesson: "${err.topic}"`
      );
      throw new Error(errorMessages.join('\n\n'));
    }

    // Build course object
    const courseData = await this.buildCourseObject(courseId);

    // We do NOT publish the course here.
    // We ONLY transfer it to Course Builder, which handles final publishing and visibility.
    try {
      await sendCourseToCourseBuilder(courseData);
      
      // After successfully sending to Course Builder:
      // 1. Increment usage_count for all topics in the course
      try {
        const topics = await this.topicRepository.findByCourseId(courseId);
        for (const topic of topics) {
          await this.topicRepository.incrementUsageCount(topic.topic_id);
        }
        logger.info('[PublishCourseUseCase] Usage count incremented for all topics in course', {
          courseId,
          topicsCount: topics.length,
        });
      } catch (usageCountError) {
        // Non-blocking: log error but don't fail the entire operation
        logger.warn('[PublishCourseUseCase] Failed to increment usage count for topics (non-blocking)', {
          courseId,
          error: usageCountError.message,
        });
      }
      
      // 2. Update course status to "archived" in database
      try {
        await this.courseRepository.update(courseId, { status: 'archived' });
        logger.info('[PublishCourseUseCase] Course status updated to archived in database', {
          courseId,
        });

        // Cleanup content_history records for all topics in this course
        try {
          const { CleanupContentHistoryOnArchive } = await import('./cleanupContentHistoryOnArchive.js');
          const cleanupService = new CleanupContentHistoryOnArchive();
          const cleanupResult = await cleanupService.cleanupCourseHistory(courseId);
          logger.info('[PublishCourseUseCase] Content history cleanup completed', {
            courseId,
            topicsProcessed: cleanupResult.topicsProcessed,
            deletedFromStorage: cleanupResult.deletedFromStorage,
            deletedFromDatabase: cleanupResult.deletedFromDatabase,
            errorsCount: cleanupResult.errors?.length || 0,
          });
        } catch (cleanupError) {
          // Non-blocking: log error but don't fail the entire operation
          logger.warn('[PublishCourseUseCase] Failed to cleanup content history (non-blocking)', {
            courseId,
            error: cleanupError.message,
          });
        }
      } catch (updateError) {
        // Non-blocking: log error but don't fail the entire operation
        logger.warn('[PublishCourseUseCase] Failed to update course status in database (non-blocking)', {
          courseId,
          error: updateError.message,
        });
      }
      
      // 3. Update Directory with course status
      if (courseData.trainer_id && courseData.course_id) {
        logger.info('[PublishCourseUseCase] Updating Directory with course status', {
          trainerId: courseData.trainer_id,
          courseId: courseData.course_id,
        });
        
        try {
          await updateCourseStatusInDirectory(
            courseData.trainer_id,
            courseData.course_id,
            'archived'
          );
          logger.info('[PublishCourseUseCase] Directory updated successfully', {
            trainerId: courseData.trainer_id,
            courseId: courseData.course_id,
          });
        } catch (directoryError) {
          // Non-blocking: log error but don't fail the entire operation
          logger.warn('[PublishCourseUseCase] Failed to update Directory (non-blocking)', {
            trainerId: courseData.trainer_id,
            courseId: courseData.course_id,
            error: directoryError.message,
          });
        }
      } else {
        logger.warn('[PublishCourseUseCase] Missing trainer_id or course_id, skipping Directory update', {
          hasTrainerId: !!courseData.trainer_id,
          hasCourseId: !!courseData.course_id,
        });
      }
    } catch (error) {
      // If Course Builder transfer fails, throw error with appropriate message
      logger.error('[PublishCourseUseCase] Failed to transfer course to Course Builder', {
        courseId,
        error: error.message,
      });
      throw new Error('Transfer failed — Course Builder could not receive the data. Please try again later.');
    }

    return {
      success: true,
      message: 'The course has been successfully transferred to Course Builder for publishing.',
    };
  }
}

