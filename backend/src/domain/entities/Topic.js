export class Topic {
  constructor({
    topic_id,
    topic_name,
    description = null,
    trainer_id,
    course_id = null,
    template_id = null,
    skills = [],
    language = null, // Language code (e.g., 'en', 'he', 'ar') - required for standalone topics
    status = 'active', // Changed from 'draft' - ENUM doesn't support 'draft'
    has_text = false,
    has_code = false,
    has_presentation = false,
    has_audio = false,
    has_mind_map = false,
    total_content_formats = 0,
    usage_count = 0,
    devlab_exercises = null, // DevLab exercises (JSONB field)
    created_at = null,
    updated_at = null,
  }) {
    this.validate({ topic_name, trainer_id, course_id, language });

    this.topic_id = topic_id;
    this.topic_name = topic_name;
    this.description = description;
    this.trainer_id = trainer_id;
    this.course_id = course_id;
    this.template_id = template_id;
    this.skills = Array.isArray(skills) ? skills : [];
    this.language = language;
    this.status = status;
    this.has_text = has_text;
    this.has_code = has_code;
    this.has_presentation = has_presentation;
    this.has_audio = has_audio;
    this.has_mind_map = has_mind_map;
    this.total_content_formats = total_content_formats;
    this.usage_count = usage_count;
    this.devlab_exercises = devlab_exercises;
    this.created_at = created_at;
    this.updated_at = updated_at;
    this.is_standalone = course_id === null;
  }

  validate({ topic_name, trainer_id, course_id, language }) {
    if (!topic_name) {
      throw new Error('Topic name is required');
    }

    if (topic_name.length < 3 || topic_name.length > 255) {
      throw new Error('Topic name must be between 3 and 255 characters');
    }

    if (!trainer_id) {
      throw new Error('Trainer ID is required');
    }

    // Language is required for standalone topics (course_id is null)
    if (course_id === null && !language) {
      throw new Error('Language is required for stand-alone topics');
    }

    // Validate language code format if provided
    if (language && (typeof language !== 'string' || language.length > 10)) {
      throw new Error('Language must be a string with maximum 10 characters');
    }
  }

  hasAllRequiredFormats() {
    return (
      this.has_text &&
      this.has_code &&
      this.has_presentation &&
      this.has_audio &&
      this.has_mind_map &&
      this.total_content_formats >= 5
    );
  }

  getMissingFormats() {
    const missing = [];
    const requiredFormats = ['text', 'code', 'presentation', 'audio', 'mind_map'];

    requiredFormats.forEach(format => {
      const flagName = `has_${format}`;
      if (!this[flagName]) {
        missing.push(format);
      }
    });

    return missing;
  }

  updateFormatFlags(contentItems) {
    // Reset flags
    this.has_text = false;
    this.has_code = false;
    this.has_presentation = false;
    this.has_audio = false;
    this.has_mind_map = false;
    this.total_content_formats = 0;

    // Update flags based on content items
    contentItems.forEach(item => {
      const contentType = item.content_type || item.content_type_id;
      switch (contentType) {
        case 'text':
          this.has_text = true;
          this.total_content_formats++;
          break;
        case 'code':
          this.has_code = true;
          this.total_content_formats++;
          break;
        case 'presentation':
          this.has_presentation = true;
          this.total_content_formats++;
          break;
        case 'audio':
          this.has_audio = true;
          this.total_content_formats++;
          break;
        case 'mind_map':
          this.has_mind_map = true;
          this.total_content_formats++;
          break;
      }
    });
  }

  incrementUsageCount() {
    this.usage_count++;
    this.updated_at = new Date().toISOString();
  }

  toJSON() {
    return {
      topic_id: this.topic_id,
      topic_name: this.topic_name,
      description: this.description,
      trainer_id: this.trainer_id,
      course_id: this.course_id,
      template_id: this.template_id,
      skills: this.skills,
      language: this.language,
      status: this.status,
      has_text: this.has_text,
      has_code: this.has_code,
      has_presentation: this.has_presentation,
      has_audio: this.has_audio,
      has_mind_map: this.has_mind_map,
      total_content_formats: this.total_content_formats,
      usage_count: this.usage_count,
      devlab_exercises: this.devlab_exercises,
      is_standalone: this.is_standalone,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}


