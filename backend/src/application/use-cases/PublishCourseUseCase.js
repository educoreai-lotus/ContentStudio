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

    logger.info('[PublishCourseUseCase] Starting course validation', { courseId });

    // Get course
    const course = await this.courseRepository.findById(courseId);
    if (!course) {
      throw new Error('Course not found');
    }

    // Get all topics for this course
    const topics = await this.topicRepository.findByCourseId(courseId);

    logger.info('[PublishCourseUseCase] Found topics for course', { 
      courseId, 
      topicsCount: topics?.length || 0 
    });

    if (!topics || topics.length === 0) {
      errors.push({
        topic: 'Course',
        issue: 'Course has no lessons/topics. Add at least one lesson before transferring.',
      });
      return { valid: false, errors };
    }

    // Validate each topic
    for (const topic of topics) {
      logger.info('[PublishCourseUseCase] Validating topic', { 
        topicId: topic.topic_id, 
        topicName: topic.topic_name,
        hasTemplateId: !!topic.template_id,
        hasDevlabExercises: !!topic.devlab_exercises,
        devlabExercisesType: typeof topic.devlab_exercises,
      });
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

      logger.info('[PublishCourseUseCase] Validating formats', {
        topicId: topic.topic_id,
        formatOrder,
        contentByTypeKeys: Object.keys(contentByType),
      });

      for (const formatName of formatOrder) {
        const dbTypeName = formatNameToDbName[formatName] || formatName;
        const content = contentByType[formatName] || contentByType[dbTypeName];

        logger.info('[PublishCourseUseCase] Checking format', {
          topicId: topic.topic_id,
          formatName,
          dbTypeName,
          hasContent: !!content,
          contentId: content?.content_id,
        });

        if (!content) {
          logger.warn('[PublishCourseUseCase] Missing format', {
            topicId: topic.topic_id,
            formatName,
            availableFormats: Object.keys(contentByType),
          });
          errors.push({
            topic: topic.topic_name || `Topic ID ${topic.topic_id}`,
            issue: `Required format '${formatName}' has not been generated for this lesson`,
          });
          continue;
        }

        // 4. Check if content is empty or failed
        let contentData;
        try {
          contentData = typeof content.content_data === 'string' 
            ? JSON.parse(content.content_data) 
            : content.content_data || {};
        } catch (parseError) {
          logger.error('[PublishCourseUseCase] Failed to parse content_data', {
            topicId: topic.topic_id,
            formatName,
            contentId: content.content_id,
            error: parseError.message,
          });
          errors.push({
            topic: topic.topic_name || `Topic ID ${topic.topic_id}`,
            issue: `Content data for format '${formatName}' is invalid (parse error)`,
          });
          continue;
        }

        // Check for failed status (for avatar_video, check if videoUrl is missing)
        if (content.content_type_id === 6) { // avatar_video
          if (!contentData.videoUrl || contentData.error) {
            logger.warn('[PublishCourseUseCase] Avatar video incomplete', {
              topicId: topic.topic_id,
              formatName,
              hasVideoUrl: !!contentData.videoUrl,
              hasError: !!contentData.error,
            });
            errors.push({
              topic: topic.topic_name || `Topic ID ${topic.topic_id}`,
              issue: `Avatar video generation failed or is incomplete for format '${formatName}'`,
            });
          }
        } else if (contentData.status === 'failed') {
          logger.warn('[PublishCourseUseCase] Content generation failed', {
            topicId: topic.topic_id,
            formatName,
            status: contentData.status,
          });
          errors.push({
            topic: topic.topic_name || `Topic ID ${topic.topic_id}`,
            issue: `Content generation failed for format '${formatName}'`,
          });
        }

        // Check if content is empty
        const isEmpty = this.isContentEmpty(contentData, formatName);
        logger.info('[PublishCourseUseCase] Content empty check', {
          topicId: topic.topic_id,
          formatName,
          isEmpty,
        });
        if (isEmpty) {
          logger.warn('[PublishCourseUseCase] Content is empty', {
            topicId: topic.topic_id,
            formatName,
            contentDataKeys: Object.keys(contentData),
          });
          errors.push({
            topic: topic.topic_name || `Topic ID ${topic.topic_id}`,
            issue: `Content for format '${formatName}' is empty or incomplete`,
          });
        }
      }

      // 5. Check DevLab exercises (stored in topics.devlab_exercises JSONB field)
      // devlab_exercises can be: null, array, or object with { html, questions, metadata }
      const hasValidExercises = (exercises) => {
        if (!exercises) {
          logger.warn('[PublishCourseUseCase] No exercises found', { topicId: topic.topic_id });
          return false;
        }
        
        // If it's a string, try to parse it
        if (typeof exercises === 'string') {
          try {
            const parsed = JSON.parse(exercises);
            logger.info('[PublishCourseUseCase] Parsed exercises string', { 
              topicId: topic.topic_id,
              parsedType: typeof parsed,
              isArray: Array.isArray(parsed),
            });
            return hasValidExercises(parsed);
          } catch (parseError) {
            // If parsing fails, check if string is not empty
            const isValid = exercises.trim().length > 0;
            logger.warn('[PublishCourseUseCase] Failed to parse exercises string', { 
              topicId: topic.topic_id,
              error: parseError.message,
              isValid,
            });
            return isValid;
          }
        }
        
        // If it's an array, check if it has items
        if (Array.isArray(exercises)) {
          const isValid = exercises.length > 0;
          logger.info('[PublishCourseUseCase] Exercises is array', { 
            topicId: topic.topic_id,
            length: exercises.length,
            isValid,
          });
          return isValid;
        }
        
        // If it's an object, check the structure: { html: "...", questions: [...], metadata: {...} }
        if (typeof exercises === 'object') {
          // Check if it has questions array with at least one question
          if (exercises.questions && Array.isArray(exercises.questions) && exercises.questions.length > 0) {
            logger.info('[PublishCourseUseCase] Exercises has valid questions array', { 
              topicId: topic.topic_id,
              questionsCount: exercises.questions.length,
            });
            return true;
          }
          // Check if it has html content
          if (exercises.html && typeof exercises.html === 'string' && exercises.html.trim().length > 0) {
            logger.info('[PublishCourseUseCase] Exercises has valid html content', { 
              topicId: topic.topic_id,
              htmlLength: exercises.html.length,
            });
            return true;
          }
          // Fallback: check if object has any meaningful keys (not just metadata)
          const keys = Object.keys(exercises);
          const isValid = keys.length > 0 && keys.some(key => key !== 'metadata');
          logger.warn('[PublishCourseUseCase] Exercises object validation', { 
            topicId: topic.topic_id,
            keys,
            isValid,
            hasQuestions: !!exercises.questions,
            hasHtml: !!exercises.html,
          });
          return isValid;
        }
        
        logger.warn('[PublishCourseUseCase] Exercises type not recognized', { 
          topicId: topic.topic_id,
          type: typeof exercises,
        });
        return false;
      };
      
      const exercises = topic.devlab_exercises;
      const exercisesValid = hasValidExercises(exercises);
      logger.info('[PublishCourseUseCase] Exercises validation result', { 
        topicId: topic.topic_id,
        topicName: topic.topic_name,
        exercisesValid,
        exercisesType: typeof exercises,
      });
      
      if (!exercisesValid) {
        errors.push({
          topic: topic.topic_name || `Topic ID ${topic.topic_id}`,
          issue: 'DevLab exercises are missing or invalid',
        });
      }
    }

    logger.info('[PublishCourseUseCase] Course validation completed', { 
      courseId,
      valid: errors.length === 0,
      errorsCount: errors.length,
      errors: errors.map(e => ({ topic: e.topic, issue: e.issue })),
    });

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
    logger.info('[PublishCourseUseCase] Starting publish course execution', { courseId });
    
    // Validate course
    const validation = await this.validateCourse(courseId);
    
    if (!validation.valid) {
      logger.error('[PublishCourseUseCase] Course validation failed', {
        courseId,
        errorsCount: validation.errors.length,
        errors: validation.errors,
      });
      const errorMessages = validation.errors.map(err => 
        `Cannot transfer the course:\n${err.issue} for the lesson: "${err.topic}"`
      );
      throw new Error(errorMessages.join('\n\n'));
    }
    
    logger.info('[PublishCourseUseCase] Course validation passed, building course object', { courseId });

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

