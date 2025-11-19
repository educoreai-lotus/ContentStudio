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

    // Map template format names to database type names
    // Template uses: 'text', 'code', 'presentation', 'audio', 'mind_map', 'avatar_video'
    // Database might use: 'text_audio' or 'text ' (with space) for text type
    // Note: 'audio' is usually combined with 'text' in 'text_audio' type
    const formatNameToDbName = {
      'text': 'text_audio', // Map template 'text' to database 'text_audio'
      'code': 'code',
      'presentation': 'presentation',
      'audio': 'text_audio', // Audio is usually part of text_audio content
      'mind_map': 'mind_map',
      'avatar_video': 'avatar_video',
    };
    
    // Also create reverse lookup for finding content
    // Try multiple variations to handle database inconsistencies (spaces, different names)
    // Database uses: 'text_audio' for text+audio content
    const possibleDbNames = {
      'text': ['text_audio', 'text', 'text '], // Try text_audio first (correct DB name), then text variations
      'audio': ['text_audio', 'audio', 'audio '], // Audio is usually part of text_audio content
      'code': ['code', 'code '],
      'presentation': ['presentation', 'presentation '],
      'mind_map': ['mind_map', 'mind_map '],
      'avatar_video': ['avatar_video', 'avatar_video '],
    };

    // Organize content by type name (using database names)
    // Normalize type names by trimming whitespace
    const contentByType = {};
    contents.forEach(content => {
      const typeId = content.content_type_id;
      let dbTypeName =
        typeof typeId === 'string' ? typeId : typeNameMap.get(typeId) || typeId;
      // Trim whitespace from type name (fix for database issues)
      dbTypeName = String(dbTypeName).trim();
      
      // Debug logging for mind_map and avatar_video
      if (typeId === 5 || typeId === 6) {
        console.log(`[ApplyTemplateToLessonUseCase] Found content_type_id ${typeId}:`, {
          typeId,
          dbTypeName,
          typeNameMapValue: typeNameMap.get(typeId),
          content_id: content.content_id,
          hasContentData: !!content.content_data,
        });
      }
      
      if (!contentByType[dbTypeName]) {
        contentByType[dbTypeName] = [];
      }
      contentByType[dbTypeName].push(content);
    });
    
    console.log('[ApplyTemplateToLessonUseCase] Content by type (normalized):', Object.keys(contentByType));
    console.log('[ApplyTemplateToLessonUseCase] Content by type details:', Object.entries(contentByType).map(([type, items]) => ({
      type,
      count: items.length,
      content_ids: items.map(c => c.content_id),
    })));

    // Apply template format order
    const formatOrder = template.format_order || [];
    const orderedContent = [];

    console.log('[ApplyTemplateToLessonUseCase] Template format_order:', formatOrder);
    console.log('[ApplyTemplateToLessonUseCase] Content by type keys:', Object.keys(contentByType));
    console.log('[ApplyTemplateToLessonUseCase] Format name to DB name mapping:', formatNameToDbName);

    // Track which content types have already been added to avoid duplicates
    // This is important for text_audio which might be referenced by both 'text' and 'audio' in template
    const addedContentTypes = new Set();
    // Also track content IDs to prevent same content appearing in multiple formats
    const addedContentIds = new Set();
    
    // Build ordered content array according to template
    // IMPORTANT: Follow the exact order specified in template.format_order
    for (let i = 0; i < formatOrder.length; i++) {
      const templateFormatType = formatOrder[i];
      
      // Try to find content by trying multiple possible database names
      let foundContent = null;
      let foundDbTypeName = null;
      
      const possibleNames = possibleDbNames[templateFormatType] || [formatNameToDbName[templateFormatType] || templateFormatType];
      
      for (const dbName of possibleNames) {
        const normalizedName = String(dbName).trim();
        if (contentByType[normalizedName]) {
          foundContent = contentByType[normalizedName];
          foundDbTypeName = normalizedName;
          break;
        }
      }
      
      console.log(`[ApplyTemplateToLessonUseCase] Processing format ${i + 1}/${formatOrder.length}: template="${templateFormatType}" -> tried: ${possibleNames.join(', ')} -> found: ${foundDbTypeName || 'none'}`);
      
      // Special handling: if both 'text' and 'audio' reference the same text_audio content,
      // only add it once, but determine the order based on which comes first in template
      if (foundContent && foundDbTypeName === 'text_audio') {
        if (addedContentTypes.has('text_audio')) {
          console.log(`[ApplyTemplateToLessonUseCase] text_audio already added, skipping duplicate for "${templateFormatType}"`);
          continue; // Skip duplicate
        }
        
        // Filter out content that has already been added (by content_id)
        const filteredContent = foundContent.filter(c => {
          if (!c.content_id) {
            console.warn(`[ApplyTemplateToLessonUseCase] Content without ID in text_audio, skipping`);
            return false;
          }
          if (addedContentIds.has(c.content_id)) {
            console.log(`[ApplyTemplateToLessonUseCase] Content ID ${c.content_id} already added, skipping duplicate`);
            return false;
          }
          addedContentIds.add(c.content_id);
          return true;
        });
        
        if (filteredContent.length === 0) {
          console.log(`[ApplyTemplateToLessonUseCase] All text_audio content already added, skipping`);
          continue;
        }
        
        // Determine if audio should be before or after text based on template order
        const textIndex = formatOrder.indexOf('text');
        const audioIndex = formatOrder.indexOf('audio');
        const audioBeforeText = audioIndex !== -1 && textIndex !== -1 && audioIndex < textIndex;
        
        // Mark as added
        addedContentTypes.add('text_audio');
        
        // Add with combined format type that indicates order
        orderedContent.push({
          format_type: audioBeforeText ? 'audio_text' : 'text_audio_combined', // Special format type for combined display
          originalFormatType: templateFormatType, // Keep original for reference
          content: filteredContent,
          audioFirst: audioBeforeText, // Flag to indicate audio should be shown first
        });
        
        console.log(`[ApplyTemplateToLessonUseCase] Added text_audio as combined format (audioFirst: ${audioBeforeText}, contentCount: ${filteredContent.length})`);
      } else if (foundContent) {
        // For other content types, check if already added by type
        if (addedContentTypes.has(foundDbTypeName)) {
          console.log(`[ApplyTemplateToLessonUseCase] ${foundDbTypeName} already added, skipping duplicate`);
          continue;
        }
        
        // Filter out content that has already been added (by content_id)
        const filteredContent = foundContent.filter(c => {
          if (!c.content_id) {
            console.warn(`[ApplyTemplateToLessonUseCase] Content without ID in ${foundDbTypeName}, skipping`);
            return false;
          }
          if (addedContentIds.has(c.content_id)) {
            console.log(`[ApplyTemplateToLessonUseCase] Content ID ${c.content_id} already added, skipping duplicate`);
            return false;
          }
          addedContentIds.add(c.content_id);
          return true;
        });
        
        if (filteredContent.length === 0) {
          console.log(`[ApplyTemplateToLessonUseCase] All ${foundDbTypeName} content already added, skipping`);
          continue;
        }
        
        addedContentTypes.add(foundDbTypeName);
        console.log(`[ApplyTemplateToLessonUseCase] Found content for "${foundDbTypeName}", adding to orderedContent at position ${orderedContent.length} (contentCount: ${filteredContent.length})`);
        orderedContent.push({
          format_type: templateFormatType, // Keep template format name for frontend
          content: filteredContent,
        });
      } else {
        console.log(`[ApplyTemplateToLessonUseCase] No content found for template "${templateFormatType}" (tried: ${possibleNames.join(', ')})`);
      }
    }
    
    console.log('[ApplyTemplateToLessonUseCase] Final orderedContent:', orderedContent.map(item => ({ type: item.format_type, contentCount: item.content.length })));

    // addedContentIds is already populated from the main loop above
    // Just log it for debugging
    console.log('[ApplyTemplateToLessonUseCase] Already added content IDs:', Array.from(addedContentIds));
    
    // Add any remaining content types not in template order (at the end)
    // BUT: Only add content that hasn't been added already (by content_id)
    // Map database type names back to template format names for display
    const dbNameToFormatName = {
      'text_audio': 'text',
      'code': 'code',
      'presentation': 'presentation',
      'audio': 'audio',
      'mind_map': 'mind_map',
      'avatar_video': 'avatar_video',
    };
    const templateDbTypes = new Set(formatOrder.map(f => formatNameToDbName[f] || f));
    
    console.log('[ApplyTemplateToLessonUseCase] Checking for content types not in template order...', {
      templateDbTypes: Array.from(templateDbTypes),
      contentByTypeKeys: Object.keys(contentByType),
      alreadyAddedContentIds: Array.from(addedContentIds),
    });
    
    Object.keys(contentByType).forEach((dbTypeName) => {
      if (!templateDbTypes.has(dbTypeName)) {
        // Filter out content that has already been added
        const newContent = contentByType[dbTypeName].filter(c => {
          if (!c.content_id) {
            console.warn(`[ApplyTemplateToLessonUseCase] Content without ID found for type ${dbTypeName}, skipping`);
            return false;
          }
          if (addedContentIds.has(c.content_id)) {
            console.log(`[ApplyTemplateToLessonUseCase] Content ID ${c.content_id} already added, skipping duplicate`);
            return false;
          }
          return true;
        });
        
        if (newContent.length > 0) {
          const formatType = dbNameToFormatName[dbTypeName] || dbTypeName;
          console.log(`[ApplyTemplateToLessonUseCase] Adding content type not in template order: ${dbTypeName} -> ${formatType}`, {
            contentCount: newContent.length,
            content_ids: newContent.map(c => c.content_id),
          });
          
          // Mark these content IDs as added
          newContent.forEach(c => {
            if (c.content_id) {
              addedContentIds.add(c.content_id);
            }
          });
          
          orderedContent.push({
            format_type: formatType,
            content: newContent,
          });
        } else {
          console.log(`[ApplyTemplateToLessonUseCase] All content for type ${dbTypeName} already added, skipping`);
        }
      } else {
        console.log(`[ApplyTemplateToLessonUseCase] Content type ${dbTypeName} already in template order, skipping`);
      }
    });

    // Update topic with template_id (always update, even if template changed)
    // This ensures the database is always in sync with the selected template
    await this.topicRepository.update(topicId, { template_id: templateId });
    console.log(`[ApplyTemplateToLessonUseCase] Updated topic ${topicId} with template_id ${templateId}`);

    const viewData = {
      lesson: {
        topic_id: topic.topic_id,
        topic_name: topic.topic_name,
        template_id: templateId,
        template_name: template.template_name,
      },
      template: {
        template_id: template.template_id,
        template_name: template.template_name,
        template_type: template.template_type,
        format_order: formatOrder,
      },
      formats: orderedContent.map((item, index) => ({
        type: item.format_type,
        display_order: index,
        audioFirst: item.audioFirst || false, // Pass audioFirst flag to frontend
        content: item.content.map(c => ({
          content_id: c.content_id,
          content_type_id: c.content_type_id,
          content_data: c.content_data,
          generation_method_id: c.generation_method_id,
          created_at: c.created_at,
          updated_at: c.updated_at,
        })),
      })),
    };

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
      view_data: viewData,
    };
  }
}

