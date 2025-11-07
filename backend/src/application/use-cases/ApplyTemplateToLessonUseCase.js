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

    // Organize content by type
    const contentByType = {};
    contents.forEach((content) => {
      const type = content.content_type_id;
      if (!contentByType[type]) {
        contentByType[type] = [];
      }
      contentByType[type].push(content);
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
    topic.template_id = templateId;
    await this.topicRepository.update(topic);

    return {
      success: true,
      template: {
        template_id: template.template_id,
        template_name: template.template_name,
        format_order: formatOrder,
      },
      lesson: {
        topic_id: topic.topic_id,
        topic_name: topic.topic_name,
        template_id: templateId,
      },
      ordered_content: orderedContent,
      view_data: {
        // Structure for frontend rendering
        formats: orderedContent.map((item) => ({
          type: item.format_type,
          display_order: formatOrder.indexOf(item.format_type),
          content: item.content.map((c) => ({
            content_id: c.content_id,
            content_data: c.content_data,
            generation_method: c.generation_method_id,
          })),
        })),
      },
    };
  }
}

