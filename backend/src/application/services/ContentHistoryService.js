import { ContentDTO } from '../dtos/ContentDTO.js';

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

    const versionNumber = await this.contentHistoryRepository.getNextVersionNumber(
      content.topic_id,
      content.content_type_id
    );
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

    const payload = {
      topic_id: content.topic_id,
      content_type_id: content.content_type_id,
      generation_method_id: content.generation_method_id,
      content_data: normalizedContentData,
      created_at: new Date(),
    };

    if (typeof versionNumber === 'number' && !Number.isNaN(versionNumber)) {
      payload.version_number = versionNumber;
    }

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

    const sortedHistoryEntries = Array.isArray(historyEntries)
      ? [...historyEntries].sort(
          (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
        )
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
        preview: this.#buildPreview(typeKey, content.content_data),
        content_data: content.content_data,
        generation_method_id: content.generation_method_id,
      },
      versions: sortedHistoryEntries.map(entry => ({
        history_id: entry.version_id,
        version_number: entry.version_number,
        created_at: entry.created_at,
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
    
    if (!content) {
      throw new Error('Content not found for history entry');
    }

    await this.saveVersion(content, { force: true });

    const updatedContent = await this.contentRepository.update(content.content_id, {
      content_data: historyEntry.content_data,
    });

    try {
      await this.contentHistoryRepository.softDelete(historyId);
    } catch (error) {
      console.warn('[ContentHistoryService] Failed to archive restored history entry:', error.message);
    }

    return ContentDTO.toContentResponse(updatedContent);
  }

  async deleteVersion(historyId) {
    await this.contentHistoryRepository.softDelete(historyId);
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
