import { ContentDTO } from '../dtos/ContentDTO.js';
import { ContentDataCleaner } from '../utils/ContentDataCleaner.js';

const CONTENT_TYPE_MAP = {
  1: 'text_audio',
  2: 'code',
  3: 'slides',
  4: 'audio',
  5: 'mind_map',
  6: 'avatar_video',
};

export class ContentHistoryService {
  constructor({ contentRepository, contentHistoryRepository }) {
    this.contentRepository = contentRepository;
    this.contentHistoryRepository = contentHistoryRepository;
  }

  async saveVersion(content, { force = false } = {}) {
    if (!content?.topic_id || !content?.content_type_id) {
      throw new Error('Content entity must include topic_id and content_type_id for history');
    }

    if (!force) {
      const latest = await this.contentHistoryRepository.findByTopicAndType(
        content.topic_id,
        content.content_type_id
      );
      const latestEntry = latest?.[0];
      if (latestEntry && this.#isSameContent(latestEntry.content_data, content.content_data)) {
        return latestEntry;
      }
    }

    const rawContentData = content.content_data;
    const normalizedContentData =
      typeof rawContentData === 'string'
        ? (() => {
            try {
              return JSON.parse(rawContentData);
            } catch (parseError) {
              console.warn('[ContentHistoryService] Failed to parse string content_data for history snapshot:', parseError.message);
              return { raw: rawContentData };
            }
          })()
        : rawContentData;

    // Clean content_data before saving to history to remove duplicates and redundant fields
    const cleanedContentData = ContentDataCleaner.clean(
      normalizedContentData,
      content.content_type_id
    );

    const now = new Date();
    const payload = {
      topic_id: content.topic_id,
      content_type_id: content.content_type_id,
      generation_method_id: content.generation_method_id,
      content_data: cleanedContentData,
      created_at: now,
      updated_at: now,
    };

    return await this.contentHistoryRepository.create(payload);
  }

  async getHistoryByContent(contentId) {
    const content = await this.contentRepository.findById(contentId);
    if (!content) {
      throw new Error('Content not found');
    }

    let historyEntries = await this.contentHistoryRepository.findByTopicAndType(
      content.topic_id,
      content.content_type_id
    );

    if ((!historyEntries || historyEntries.length === 0) && typeof this.contentRepository.findAllByTopicId === 'function') {
      try {
        const allContent = await this.contentRepository.findAllByTopicId(content.topic_id, {
          includeArchived: true,
        });
        const related = (allContent || [])
          .filter(item => item.content_id !== content.content_id)
          .filter(item => this.#contentTypesMatch(item.content_type_id, content.content_type_id));

        const relatedHistoryEntries = [];
        for (const relatedContent of related) {
          try {
            const entries = await this.contentHistoryRepository.findByTopicAndType(
              relatedContent.topic_id,
              relatedContent.content_type_id
            );
            entries.forEach(entry => {
              relatedHistoryEntries.push({
                ...entry,
                source_topic_id: relatedContent.topic_id,
                source_content_type_id: relatedContent.content_type_id,
              });
            });
          } catch (error) {
            console.warn(
              '[ContentHistoryService] Failed to load history for related content:',
              relatedContent.content_id,
              error.message
            );
          }
        }

        if (relatedHistoryEntries.length > 0) {
          historyEntries = relatedHistoryEntries;
        }
      } catch (error) {
        console.warn(
          '[ContentHistoryService] Failed to inspect related content for history backfill:',
          error.message
        );
      }
    }

    // Sort by updated_at DESC, then created_at DESC (LIFO strategy)
    const sortedHistoryEntries = Array.isArray(historyEntries)
      ? [...historyEntries].sort((a, b) => {
          const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
          const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
          if (bTime !== aTime) return bTime - aTime;
          // If updated_at is the same, sort by created_at
          const aCreated = new Date(a.created_at || 0).getTime();
          const bCreated = new Date(b.created_at || 0).getTime();
          return bCreated - aCreated;
        })
      : [];
    const typeKey = CONTENT_TYPE_MAP[content.content_type_id] || 'unknown';

    return {
      content_id: content.content_id,
      topic_id: content.topic_id,
      type: typeKey,
      current: {
        history_id: null,
        version_label: 'current',
        updated_at: content.updated_at,
        created_at: content.created_at,
        preview: this.#buildPreview(typeKey, content.content_data),
        content_data: content.content_data,
        generation_method_id: content.generation_method_id,
      },
      versions: sortedHistoryEntries.map(entry => ({
        history_id: entry.version_id,
        created_at: entry.created_at,
        updated_at: entry.updated_at || entry.created_at,
        preview: this.#buildPreview(typeKey, entry.content_data),
        content_data: entry.content_data,
        generation_method_id: entry.generation_method_id,
        source_topic_id: entry.source_topic_id || content.topic_id,
        source_content_type_id: entry.source_content_type_id || content.content_type_id,
      })),
    };
  }

  async restoreVersion(historyId) {
    const historyEntry = await this.contentHistoryRepository.findById(historyId);
    if (!historyEntry) {
      throw new Error('History entry not found');
    }

    const content = await this.contentRepository.findLatestByTopicAndType(
      historyEntry.topic_id,
      historyEntry.content_type_id
    );
    
    let restoredContent;
    
    if (!content) {
      // Content doesn't exist - create new content from history
      console.log('[ContentHistoryService] Content not found, creating new content from history:', {
        topic_id: historyEntry.topic_id,
        content_type_id: historyEntry.content_type_id,
        history_id: historyId,
      });
      
      // Create new content from history entry
      const newContent = {
        topic_id: historyEntry.topic_id,
        content_type_id: historyEntry.content_type_id,
        generation_method_id: historyEntry.generation_method_id,
        content_data: historyEntry.content_data,
      };
      
      restoredContent = await this.contentRepository.create(newContent);
    } else {
      // Content exists - save current version to history, then restore
      console.log('[ContentHistoryService] Content found, saving current version to history before restoring:', {
        content_id: content.content_id,
        topic_id: historyEntry.topic_id,
        content_type_id: historyEntry.content_type_id,
      });
      
      // Save current content to history before restoring
      await this.saveVersion(content, { force: true });

      // Restore the historical version to active content
      restoredContent = await this.contentRepository.update(content.content_id, {
        content_data: historyEntry.content_data,
      });
    }

    // Soft delete the restored history entry (it's now the active version)
    try {
      await this.contentHistoryRepository.softDelete(historyId);
    } catch (error) {
      console.warn('[ContentHistoryService] Failed to archive restored history entry:', error.message);
    }

    return ContentDTO.toContentResponse(restoredContent);
  }

  async deleteVersion(historyId) {
    await this.contentHistoryRepository.softDelete(historyId);
  }

  async getHistoryByTopic(topicId) {
    const historyEntries = await this.contentHistoryRepository.findByTopic(topicId);

    // Group by content_type_id
    const grouped = {};
    historyEntries.forEach(entry => {
      const typeId = entry.content_type_id;
      if (!grouped[typeId]) {
        grouped[typeId] = [];
      }
      grouped[typeId].push(entry);
    });

    // Build response for each content type
    const result = {};
    Object.keys(grouped).forEach(typeId => {
      const entries = grouped[typeId];
      const typeKey = CONTENT_TYPE_MAP[typeId] || 'unknown';
      
      // Sort by updated_at DESC, then created_at DESC
      const sorted = [...entries].sort((a, b) => {
        const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
        const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
        if (bTime !== aTime) return bTime - aTime;
        const aCreated = new Date(a.created_at || 0).getTime();
        const bCreated = new Date(b.created_at || 0).getTime();
        return bCreated - aCreated;
      });

      result[typeKey] = sorted.map(entry => ({
        history_id: entry.version_id || entry.history_id, // version_id is mapped from history_id in mapRowToContentVersion
        content_type_id: entry.content_type_id,
        created_at: entry.created_at,
        updated_at: entry.updated_at || entry.created_at,
        preview: this.#buildPreview(typeKey, entry.content_data),
        content_data: entry.content_data,
        generation_method_id: entry.generation_method_id,
      }));
    });

    return result;
  }

  #isSameContent(a, b) {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch (error) {
      return false;
    }
  }

  #buildPreview(typeKey, contentData) {
    if (!contentData) return '';

    switch (typeKey) {
      case 'text_audio': {
        const text = contentData.text || contentData.body || '';
        return text.length > 160 ? `${text.slice(0, 157)}...` : text;
      }
      case 'slides': {
        const title = contentData.presentation?.title || contentData.title || 'Slide deck';
        const slideCount = contentData.slide_count || contentData.slides?.length;
        return `${title}${slideCount ? ` (${slideCount} slides)` : ''}`;
      }
      case 'mind_map': {
        if (Array.isArray(contentData?.nodes)) {
          return `Mind map with ${contentData.nodes.length} nodes`;
        }
        return 'Mind map structure';
      }
      case 'code': {
        const snippet = contentData.code || contentData.snippet || '';
        return snippet.length > 160 ? `${snippet.slice(0, 157)}...` : snippet;
      }
      case 'avatar_video': {
        return contentData.videoUrl || contentData.storageUrl || 'Avatar video';
      }
      default:
        return typeof contentData === 'string'
          ? contentData.slice(0, 160)
          : JSON.stringify(contentData).slice(0, 160);
    }
  }

  #contentTypesMatch(a, b) {
    if (a === b) return true;

    const normalize = value => {
      if (value === undefined || value === null) {
        return { numeric: null, text: null };
      }

      const numeric = Number(value);
      const text =
        typeof value === 'string'
          ? value.trim().toLowerCase()
          : typeof numeric === 'number' && !Number.isNaN(numeric)
          ? String(numeric)
          : null;

      return {
        numeric: Number.isNaN(numeric) ? null : numeric,
        text,
      };
    };

    const normalizedA = normalize(a);
    const normalizedB = normalize(b);

    if (
      normalizedA.numeric !== null &&
      normalizedB.numeric !== null &&
      normalizedA.numeric === normalizedB.numeric
    ) {
      return true;
    }

    if (normalizedA.text && normalizedB.text && normalizedA.text === normalizedB.text) {
      return true;
    }

    return false;
  }
}
