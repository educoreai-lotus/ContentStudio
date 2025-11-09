import { TemplateRepository } from '../../domain/repositories/TemplateRepository.js';
import { TopicRepository } from '../../domain/repositories/TopicRepository.js';
import { ContentRepository } from '../../domain/repositories/ContentRepository.js';

/**
 * Apply Template to Lesson Use Case
 * 
 * Flow:
 * 1. Trainer creates lesson content and exercises
 * 2. Trainer selects a template
 * 3. System applies template format order to lesson
 * 4. Trainer sees lesson view according to template
 */
export class ApplyTemplateToLessonUseCase {
  constructor({ templateRepository, topicRepository, contentRepository }) {
    this.templateRepository = templateRepository;
    this.topicRepository = topicRepository;
    this.contentRepository = contentRepository;
  }

  /**
   * Apply template to a lesson (topic)
   * @param {Object} params - Parameters
   * @param {number} params.topicId - Topic/Lesson ID
   * @param {number} params.templateId - Template ID to apply
   * @returns {Promise<Object>} Applied template with lesson content
   */
  async execute({ topicId, templateId }) {
    if (!topicId) {
      throw new Error('topic_id is required');
    }

    // templateId is optional - can be null if getting view for existing template

    // Get topic/lesson first
    const topic = await this.topicRepository.findById(topicId);
    if (!topic) {
      throw new Error('Topic/Lesson not found');
    }

    // Get template (use topic's template_id if templateId not provided)
    const actualTemplateId = templateId || topic.template_id;
    if (!actualTemplateId) {
      throw new Error('Template not specified. Please apply a template to this lesson first.');
    }

    const template = await this.templateRepository.findById(actualTemplateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Get all content for this topic
    const contents = await this.contentRepository.findAllByTopicId(topicId);

    // Build map of type IDs to type names for ordering
    const typeIds = contents
      .map(content => content.content_type_id)
      .filter(id => typeof id === 'number');
    const typeNameMap = await this.contentRepository.getContentTypeNamesByIds(typeIds);

    // Organize content by type name
    const contentByType = {};
    contents.forEach(content => {
      const typeId = content.content_type_id;
      const typeName =
        typeof typeId === 'string' ? typeId : typeNameMap.get(typeId) || typeId;
      if (!contentByType[typeName]) {
        contentByType[typeName] = [];
      }
      contentByType[typeName].push(content);
    });

    // Apply template format order
    const formatOrder = template.format_order || [];
    const orderedContent = [];

    // Build ordered content array according to template
    for (const formatType of formatOrder) {
      if (contentByType[formatType]) {
        orderedContent.push({
          format_type: formatType,
          content: contentByType[formatType],
        });
      }
    }

    // Add any remaining content types not in template order
    const templateTypes = new Set(formatOrder);
    Object.keys(contentByType).forEach((type) => {
      if (!templateTypes.has(type)) {
        orderedContent.push({
          format_type: type,
          content: contentByType[type],
        });
      }
    });

    // Update topic with template_id
    await this.topicRepository.update(topicId, { template_id: templateId });

    return {
      success: true,
      message: 'Template applied successfully',
      template: {
        template_id: template.template_id,
        template_name: template.template_name,
        template_type: template.template_type,
        format_order: formatOrder,
      },
      lesson: {
        topic_id: topic.topic_id,
        topic_name: topic.topic_name,
        template_id: templateId,
      },
      ordered_content: orderedContent,
    };
  }
}

