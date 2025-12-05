import { CreateTemplateUseCase } from './CreateTemplateUseCase.js';
import { Template } from '../../domain/entities/Template.js';

/**
 * Generate Template With AI Use Case
 * Creates a new template using AI suggestions (with safe fallbacks)
 */
export class GenerateTemplateWithAIUseCase {
  constructor({ templateRepository, topicRepository, aiGenerationService }) {
    this.templateRepository = templateRepository;
    this.topicRepository = topicRepository;
    this.aiGenerationService = aiGenerationService;
    this.createTemplateUseCase = new CreateTemplateUseCase({ templateRepository });
  }

  /**
   * Execute AI template generation
   * @param {Object} params
   * @param {number} params.topicId - Topic ID the template is generated for
   * @param {string} params.trainerId - Trainer creating the template
   * @param {string} [params.templateName] - Optional custom template name
   */
  async execute({ topicId, trainerId, templateName }) {
    if (!topicId) {
      throw new Error('topic_id is required for AI template generation');
    }

    const topic = await this.topicRepository.findById(topicId);
    if (!topic) {
      throw new Error('Topic not found');
    }

    const baseOrder = ['text', 'audio', 'presentation', 'code', 'mind_map', 'avatar_video'];
    let aiSuggestedOrder = [...baseOrder];
    let aiTemplateName =
      templateName ||
      `${topic.topic_name} AI Flow`.substring(0, 200);
    let aiNotes = null;
    let aiFeedback = null;

    if (this.aiGenerationService) {
      try {
        const prompt = `
You are an educational content template designer for EduCore Content Studio.
You must output a JSON object only.

Rules:
- Formats must be one of: text, audio, code, presentation, mind_map, avatar_video.
- Include each format exactly once (6 items total).
- Place "audio" immediately after "text" (either text then audio, or audio then text).
- Include "avatar_video" as one of the formats (it's a video avatar explaining the content).
- Return JSON: {"template_name": "...", "format_order": ["text","audio","presentation","code","mind_map","avatar_video"], "notes": "...", "feedback": "..."}.
- The "feedback" field should explain WHY you chose this specific order for the formats. Be concise (2-3 sentences) and educational.

Context:
- Topic: ${topic.topic_name}
- Description: ${topic.description || 'N/A'}
- Skills: ${(topic.skills || []).join(', ') || 'N/A'}

Return only JSON (no extra text).
        `;

        const aiResponse = await this.aiGenerationService.generateText(prompt, {
          temperature: 0.4,
          max_tokens: 500,
        });

        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.format_order)) {
            aiSuggestedOrder = parsed.format_order.map(item => item.trim());
          }
          if (parsed.template_name) {
            aiTemplateName = parsed.template_name.substring(0, 200);
          }
          if (parsed.notes) {
            aiNotes = parsed.notes.substring(0, 500);
          }
          if (parsed.feedback) {
            aiFeedback = parsed.feedback.substring(0, 300);
          }
        }
      } catch (error) {
        console.warn('[GenerateTemplateWithAIUseCase] Failed to parse AI response, using fallback:', error.message);
      }
    }

    // Ensure mandatory formats exist and audio is paired with text
    aiSuggestedOrder = this.normalizeFormatOrder(aiSuggestedOrder);

    const templateData = {
      template_name: aiTemplateName,
      format_order: aiSuggestedOrder,
      template_type: 'ai_generated',
      description: aiNotes || `AI generated template for ${topic.topic_name}`,
      notes: aiNotes,
      created_by: trainerId || topic.trainer_id || 'system',
    };

    const template = await this.createTemplateUseCase.execute(templateData);
    
    // Return template with AI feedback if available
    return {
      ...template,
      aiFeedback: aiFeedback || null,
    };
  }

  /**
   * Normalize format order to ensure it meets mandatory requirements
   * @param {string[]} order
   * @returns {string[]}
   */
  normalizeFormatOrder(order = []) {
    const allowed = ['text', 'audio', 'code', 'presentation', 'mind_map', 'avatar_video'];
    let sanitized = order
      .map(item => item && item.toLowerCase())
      .filter(item => allowed.includes(item));

    // Remove duplicates preserving order
    sanitized = sanitized.filter((item, index) => sanitized.indexOf(item) === index);

    // Ensure all mandatory formats exist
    const mandatory = ['text', 'code', 'presentation', 'audio', 'mind_map', 'avatar_video'];
    mandatory.forEach(format => {
      if (!sanitized.includes(format)) {
        sanitized.push(format);
      }
    });

    // Ensure audio is immediately after text
    const textIndex = sanitized.indexOf('text');
    const audioIndex = sanitized.indexOf('audio');

    if (textIndex === -1 || audioIndex === -1) {
      return ['text', 'audio', 'presentation', 'code', 'mind_map', 'avatar_video'];
    }

    if (audioIndex !== textIndex + 1) {
      // Remove audio and re-insert immediately after text
      sanitized.splice(audioIndex, 1);
      sanitized.splice(textIndex + 1, 0, 'audio');
    }

    // Trim to exactly 6 formats in case extras were added
    return sanitized.slice(0, 6);
  }
}

