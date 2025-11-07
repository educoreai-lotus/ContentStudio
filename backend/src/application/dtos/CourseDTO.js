/**
 * Course Data Transfer Objects
 */
export class CreateCourseDTO {
  constructor(data) {
    this.course_name = data.course_name;
    this.description = data.description || null;
    this.trainer_id = data.trainer_id;
    this.skills = Array.isArray(data.skills) ? data.skills : [];
    this.language = data.language || 'en';
    this.company_logo = data.company_logo || null;
  }
}

export class UpdateCourseDTO {
  constructor(data) {
    if (data.course_name !== undefined) this.course_name = data.course_name;
    if (data.description !== undefined) this.description = data.description;
    if (data.skills !== undefined) this.skills = Array.isArray(data.skills) ? data.skills : [];
    if (data.language !== undefined) this.language = data.language;
    if (data.status !== undefined) this.status = data.status;
    if (data.company_logo !== undefined) this.company_logo = data.company_logo;
  }
}

export class CourseResponseDTO {
  constructor(course) {
    this.course_id = course.course_id;
    this.course_name = course.course_name;
    this.description = course.description;
    this.trainer_id = course.trainer_id;
    this.skills = course.skills;
    this.language = course.language;
    this.status = course.status;
    this.company_logo = course.company_logo;
    this.created_at = course.created_at;
    this.updated_at = course.updated_at;
  }
}

