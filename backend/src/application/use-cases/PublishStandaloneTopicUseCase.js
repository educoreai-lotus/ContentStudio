import { sendCourseToCourseBuilder } from '../../infrastructure/courseBuilderClient/courseBuilderClient.js';
import { logger } from '../../infrastructure/logging/Logger.js';

/**
 * Publish Standalone Topic Use Case
 * 
 * Handles publishing a standalone topic (lesson) to Course Builder.
 * Similar to PublishCourseUseCase but for a single standalone topic.
 * 
 * Flow:
 * 1. Validate topic has all required content formats
 * 2. Build topic object for Course Builder
 * 3. Send to Course Builder
 * 4. Update topic status to "ready" or "completed"
 * 5. Increment usage_count
 */
export class PublishStandaloneTopicUseCase {
  constructor({ topicRepository, contentRepository, templateRepository, exerciseRepository }) {
    this.topicRepository = topicRepository;
    this.contentRepository = contentRepository;
    this.templateRepository = templateRepository;
    this.exerciseRepository = exerciseRepository;
  }

  /**
   * Validate standalone topic before transfer to Course Builder
   * @param {number} topicId - Topic ID
   * @returns {Promise<{valid: boolean, errors: Array<string>}>}
   */
  async validateTopic(topicId) {
    const errors = [];

    // Get topic
    const topic = await this.topicRepository.findById(topicId);
    if (!topic) {
      throw new Error('Topic not found');
    }

    // Check if topic is standalone
    if (topic.course_id !== null) {
      errors.push('This topic belongs to a course. Use course publish instead.');
      return { valid: false, errors };
    }

    // 1. Check if template is selected
    if (!topic.template_id) {
      errors.push('A template has not been selected for this lesson');
      return { valid: false, errors };
    }

    // Get template to check format_order
    const template = await this.templateRepository.findById(topic.template_id);
    if (!template) {
      errors.push('Selected template not found');
      return { valid: false, errors };
    }

    // Get format_order from template
    const formatOrder = template.format_order || [];
    if (!Array.isArray(formatOrder) || formatOrder.length === 0) {
      errors.push('Template has no format order defined');
      return { valid: false, errors };
    }

    // 2. Get all content for this topic
    const contents = await this.contentRepository.findAllByTopicId(topicId);

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
          contentByType['audio'] = content;
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
        errors.push(`Required format '${formatName}' has not been generated for this lesson`);
        continue;
      }

      // 4. Check if content is empty or failed
      const contentData = typeof content.content_data === 'string' 
        ? JSON.parse(content.content_data) 
        : content.content_data || {};

      // Check for failed status (for avatar_video, check if videoUrl is missing)
      if (content.content_type_id === 6) { // avatar_video
        if (!contentData.videoUrl || contentData.error) {
          errors.push(`Avatar video generation failed or is incomplete for format '${formatName}'`);
        }
      } else if (contentData.status === 'failed') {
        errors.push(`Content generation failed for format '${formatName}'`);
      }

      // Check if content is empty
      const isEmpty = this.isContentEmpty(contentData, formatName);
      if (isEmpty) {
        errors.push(`Content for format '${formatName}' is empty or incomplete`);
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
   * Build topic object for Course Builder
   * @param {number} topicId - Topic ID
   * @returns {Promise<Object>} Topic object ready for Course Builder
   */
  async buildTopicObject(topicId) {
    const topic = await this.topicRepository.findById(topicId);
    if (!topic) {
      throw new Error('Topic not found');
    }

    const template = await this.templateRepository.findById(topic.template_id);
    const contents = await this.contentRepository.findAllByTopicId(topicId);
    
    // Get exercises
    let exercises = [];
    try {
      exercises = await this.exerciseRepository.findByTopicId(topicId);
    } catch (error) {
      logger.warn('[PublishStandaloneTopicUseCase] Could not fetch exercises', {
        topicId,
        error: error.message,
      });
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

    // Build a "course-like" object with a single topic for Course Builder
    return {
      course_id: `standalone-${topicId}`, // Use topic ID as course ID for standalone
      course_name: topic.topic_name || '',
      course_description: topic.description || '',
      course_language: topic.language || 'en',
      trainer_id: topic.trainer_id || '',
      trainer_name: topic.trainer_id || '', // TODO: Get trainer name from auth
      topics: [{
        topic_id: String(topic.topic_id),
        topic_name: topic.topic_name || '',
        topic_description: topic.description || '',
        topic_language: topic.language || 'en',
        template_id: String(topic.template_id),
        format_order: template?.format_order || [],
        contents: contentsData,
        devlab_exercises: exercises.length > 0 ? JSON.stringify(exercises) : '',
      }],
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
   * Execute publish standalone topic (transfer to Course Builder)
   * @param {number} topicId - Topic ID
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async execute(topicId) {
    // Validate topic
    const validation = await this.validateTopic(topicId);
    
    if (!validation.valid) {
      const errorMessages = validation.errors.map(err => err).join('\n');
      throw new Error(`Cannot transfer the lesson:\n${errorMessages}`);
    }

    // Build topic object
    const topicData = await this.buildTopicObject(topicId);

    try {
      // Send to Course Builder
      await sendCourseToCourseBuilder(topicData);
      
      // After successfully sending to Course Builder:
      // 1. Increment usage_count for the topic
      try {
        await this.topicRepository.incrementUsageCount(topicId);
        logger.info('[PublishStandaloneTopicUseCase] Usage count incremented for topic', {
          topicId,
        });
      } catch (usageCountError) {
        // Non-blocking: log error but don't fail the entire operation
        logger.warn('[PublishStandaloneTopicUseCase] Failed to increment usage count (non-blocking)', {
          topicId,
          error: usageCountError.message,
        });
      }
      
      // 2. Update topic status to "ready" or "completed"
      try {
        await this.topicRepository.update(topicId, { status: 'ready' });
        logger.info('[PublishStandaloneTopicUseCase] Topic status updated to ready', {
          topicId,
        });
      } catch (updateError) {
        // Non-blocking: log error but don't fail the entire operation
        logger.warn('[PublishStandaloneTopicUseCase] Failed to update topic status (non-blocking)', {
          topicId,
          error: updateError.message,
        });
      }
    } catch (error) {
      // If Course Builder transfer fails, throw error with appropriate message
      logger.error('[PublishStandaloneTopicUseCase] Failed to transfer topic to Course Builder', {
        topicId,
        error: error.message,
      });
      throw new Error('Transfer failed — Course Builder could not receive the data. Please try again later.');
    }

    return {
      success: true,
      message: 'The lesson has been successfully saved and sent to Course Builder.',
    };
  }
}

