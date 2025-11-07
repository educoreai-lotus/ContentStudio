export class HandleExchangeRequestUseCase {
  constructor({ topicRepository, contentRepository, courseRepository }) {
    this.topicRepository = topicRepository;
    this.contentRepository = contentRepository;
    this.courseRepository = courseRepository;
  }

  async execute({ serviceName, payload }) {
    if (!serviceName || typeof serviceName !== 'string') {
      throw new Error('serviceName is required');
    }

    if (payload === undefined || payload === null) {
      throw new Error('payload is required');
    }

    let parsedPayload;
    if (typeof payload === 'string') {
      try {
        parsedPayload = JSON.parse(payload);
      } catch (error) {
        throw new Error('payload must be a valid JSON string');
      }
    } else if (typeof payload === 'object') {
      parsedPayload = { ...payload };
    } else {
      throw new Error('payload must be a JSON string or object');
    }

    const filledPayload = await this.fillPayload(parsedPayload, serviceName);

    return filledPayload;
  }

  async fillPayload(payload, requester) {
    const result = { ...payload };

    const latestTopic = await this.resolveLatestTopic();
    const topicContent = latestTopic
      ? await this.getContentForTopic(latestTopic.topic_id)
      : [];

    if (Object.prototype.hasOwnProperty.call(result, 'lessonTopic')) {
      result.lessonTopic = latestTopic?.topic_name || 'No lesson topic available yet';
    }

    if (Object.prototype.hasOwnProperty.call(result, 'lessonDescription')) {
      result.lessonDescription =
        latestTopic?.description || 'Description not available yet';
    }

    if (Object.prototype.hasOwnProperty.call(result, 'skills')) {
      const topicSkills = Array.isArray(latestTopic?.skills) ? latestTopic.skills : [];
      const inferredSkills = this.inferSkillsFromContent(topicContent);
      const mergedSkills = [...new Set([...topicSkills, ...inferredSkills])];
      result.skills = mergedSkills.length > 0 ? mergedSkills : ['Curriculum Planning'];
    }

    if (Object.prototype.hasOwnProperty.call(result, 'formats')) {
      result.formats = this.extractFormatsFromContent(topicContent);
    }

    if (Object.prototype.hasOwnProperty.call(result, 'frequentLanguages')) {
      result.frequentLanguages = ['en', 'he', 'ar'];
    }

    if (Object.prototype.hasOwnProperty.call(result, 'requestedBy')) {
      result.requestedBy = requester;
    }

    if (Object.prototype.hasOwnProperty.call(result, 'courseSummary')) {
      result.courseSummary = await this.buildCourseSummary();
    }

    return result;
  }

  async resolveLatestTopic() {
    const topics = await this.topicRepository.findAll({}, { page: 1, limit: 1 });

    if (Array.isArray(topics) && topics.length > 0) {
      return topics[0];
    }

    return null;
  }

  async getContentForTopic(topicId) {
    if (!this.contentRepository || !topicId) {
      return [];
    }

    if (typeof this.contentRepository.findByTopicId === 'function') {
      return await this.contentRepository.findByTopicId(topicId);
    }

    if (typeof this.contentRepository.findAllByTopicId === 'function') {
      return await this.contentRepository.findAllByTopicId(topicId);
    }

    return [];
  }

  inferSkillsFromContent(contentItems) {
    if (!Array.isArray(contentItems)) {
      return [];
    }

    const skillSet = new Set();

    contentItems.forEach(item => {
      if (!item || !item.content_data) {
        return;
      }

      const metadataSkills = item.content_data?.metadata?.skillsList;
      if (Array.isArray(metadataSkills)) {
        metadataSkills.forEach(skill => skill && skillSet.add(skill));
      }
    });

    return Array.from(skillSet);
  }

  extractFormatsFromContent(contentItems) {
    if (!Array.isArray(contentItems) || contentItems.length === 0) {
      return ['text', 'code', 'presentation', 'audio', 'mind_map'];
    }

    const formats = new Set();
    contentItems.forEach(item => {
      if (item?.content_type_id) {
        formats.add(item.content_type_id);
      }
    });

    if (formats.size === 0) {
      return ['text', 'code', 'presentation', 'audio', 'mind_map'];
    }

    return Array.from(formats);
  }

  async buildCourseSummary() {
    if (!this.courseRepository || !this.courseRepository.findAll) {
      return {
        totalCourses: 0,
        activeCourses: 0,
      };
    }

    const courses = await this.courseRepository.findAll();

    if (!Array.isArray(courses) || courses.length === 0) {
      return {
        totalCourses: 0,
        activeCourses: 0,
      };
    }

    const totalCourses = courses.length;
    const activeCourses = courses.filter(course => course.status !== 'archived').length;

    return {
      totalCourses,
      activeCourses,
    };
  }
}


