/**
 * Topic Data Transfer Objects
 */
export class CreateTopicDTO {
  constructor(data) {
    this.topic_name = data.topic_name;
    this.description = data.description || null;
    this.trainer_id = data.trainer_id;
    this.course_id = data.course_id || null;
    this.template_id = data.template_id || null;
    this.skills = Array.isArray(data.skills) ? data.skills : [];
  }
}

export class UpdateTopicDTO {
  constructor(data) {
    if (data.topic_name !== undefined) this.topic_name = data.topic_name;
    if (data.description !== undefined) this.description = data.description;
    if (data.course_id !== undefined) this.course_id = data.course_id;
    if (data.template_id !== undefined) this.template_id = data.template_id;
    if (data.skills !== undefined) this.skills = Array.isArray(data.skills) ? data.skills : [];
    if (data.status !== undefined) this.status = data.status;
  }
}

export class TopicResponseDTO {
  constructor(topic) {
    this.topic_id = topic.topic_id;
    this.topic_name = topic.topic_name;
    this.description = topic.description;
    this.trainer_id = topic.trainer_id;
    this.course_id = topic.course_id;
    this.template_id = topic.template_id;
    this.skills = topic.skills;
    this.status = topic.status;
    this.format_flags = {
      has_text: topic.has_text,
      has_code: topic.has_code,
      has_presentation: topic.has_presentation,
      has_audio: topic.has_audio,
      has_mind_map: topic.has_mind_map,
    };
    this.total_content_formats = topic.total_content_formats;
    this.usage_count = topic.usage_count;
    this.is_standalone = topic.is_standalone;
    this.created_at = topic.created_at;
    this.updated_at = topic.updated_at;
  }
}


