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
    if (!content?.content_id) {
      throw new Error('Content entity is required to save history');
    }

    if (!force) {
      const latest = await this.contentHistoryRepository.findByContentId(content.content_id);
      const latestEntry = latest?.[0];
      if (latestEntry && this.#isSameContent(latestEntry.content_data, content.content_data)) {
        return latestEntry;
      }
    }

    const versionNumber = await this.contentHistoryRepository.getNextVersionNumber(content.content_id);
    const payload = {
      content_id: content.content_id,
      topic_id: content.topic_id,
      content_type_id: content.content_type_id,
      generation_method_id: content.generation_method_id,
      content_data: content.content_data,
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

    const historyEntries = await this.contentHistoryRepository.findByContentId(contentId);
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
      versions: historyEntries.map(entry => ({
        history_id: entry.version_id,
        version_number: entry.version_number,
        created_at: entry.created_at,
        preview: this.#buildPreview(typeKey, entry.content_data),
        content_data: entry.content_data,
        generation_method_id: entry.generation_method_id,
      })),
    };
  }

  async restoreVersion(historyId) {
    const historyEntry = await this.contentHistoryRepository.findById(historyId);
    if (!historyEntry) {
      throw new Error('History entry not found');
    }

    const content = await this.contentRepository.findById(historyEntry.content_id);
    if (!content) {
      throw new Error('Content not found for history entry');
    }

    await this.saveVersion(content, { force: true });

    const updatedContent = await this.contentRepository.update(historyEntry.content_id, {
      content_data: historyEntry.content_data,
    });

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
}
