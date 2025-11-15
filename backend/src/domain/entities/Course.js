export class Course {
  constructor({
    course_id,
    course_name,
    description = null,
    trainer_id,
    skills = [],
    language = 'en',
    status = 'active',
    company_logo = null,
    permissions = null,
    usage_count = 0,
    created_at = null,
    updated_at = null,
  }) {
    this.validate({ course_name, trainer_id, description });

    this.course_id = course_id;
    this.course_name = course_name;
    this.description = description;
    this.trainer_id = trainer_id;
    this.skills = Array.isArray(skills) ? skills : [];
    this.language = language;
    this.status = status;
    this.company_logo = company_logo;
    this.permissions = permissions;
    this.usage_count = usage_count || 0;
    this.created_at = created_at;
    this.updated_at = updated_at;
  }

  validate({ course_name, trainer_id, description }) {
    if (!course_name) {
      throw new Error('Course name is required');
    }

    if (course_name.length < 3 || course_name.length > 255) {
      throw new Error('Course name must be between 3 and 255 characters');
    }

    if (!trainer_id) {
      throw new Error('Trainer ID is required');
    }

    if (description && description.length > 2000) {
      throw new Error('Description must not exceed 2000 characters');
    }
  }

  softDelete() {
    this.status = 'deleted';
    this.updated_at = new Date().toISOString();
  }

  archive() {
    this.status = 'archived';
    this.updated_at = new Date().toISOString();
  }

  activate() {
    this.status = 'active';
    this.updated_at = new Date().toISOString();
  }

  incrementUsageCount() {
    this.usage_count++;
    this.updated_at = new Date().toISOString();
  }

  toJSON() {
    return {
      course_id: this.course_id,
      course_name: this.course_name,
      description: this.description,
      trainer_id: this.trainer_id,
      skills: this.skills,
      language: this.language,
      status: this.status,
      company_logo: this.company_logo,
      permissions: this.permissions,
      usage_count: this.usage_count,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}

