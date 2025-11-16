/**
 * Exercise Entity
 * Represents a DevLab exercise for a topic
 */
export class Exercise {
  constructor({
    exercise_id,
    topic_id,
    question_text,
    question_type,
    programming_language,
    language = 'en',
    skills = [],
    hint = null,
    solution = null,
    test_cases = null,
    difficulty = null,
    points = 10,
    order_index = 0,
    generation_mode, // 'ai' or 'manual'
    validation_status = 'pending', // 'pending', 'approved', 'rejected'
    validation_message = null,
    devlab_response = null,
    created_by,
    created_at = null,
    updated_at = null,
    status = 'active',
  }) {
    this.exercise_id = exercise_id;
    this.topic_id = topic_id;
    this.question_text = question_text;
    this.question_type = question_type; // 'code' or 'theoretical'
    this.programming_language = programming_language;
    this.language = language;
    this.skills = Array.isArray(skills) ? skills : [];
    this.hint = hint;
    this.solution = solution;
    this.test_cases = test_cases;
    this.difficulty = difficulty;
    this.points = points;
    this.order_index = order_index;
    this.generation_mode = generation_mode;
    this.validation_status = validation_status;
    this.validation_message = validation_message;
    this.devlab_response = devlab_response;
    this.created_by = created_by;
    this.created_at = created_at;
    this.updated_at = updated_at;
    this.status = status;
  }

  toJSON() {
    return {
      exercise_id: this.exercise_id,
      topic_id: this.topic_id,
      question_text: this.question_text,
      question_type: this.question_type,
      programming_language: this.programming_language,
      language: this.language,
      skills: this.skills,
      hint: this.hint,
      solution: this.solution,
      test_cases: this.test_cases,
      difficulty: this.difficulty,
      points: this.points,
      order_index: this.order_index,
      generation_mode: this.generation_mode,
      validation_status: this.validation_status,
      validation_message: this.validation_message,
      devlab_response: this.devlab_response,
      created_by: this.created_by,
      created_at: this.created_at,
      updated_at: this.updated_at,
      status: this.status,
    };
  }

  /**
   * Mark exercise as approved
   * @param {string} message - Optional validation message
   */
  approve(message = null) {
    this.validation_status = 'approved';
    if (message) {
      this.validation_message = message;
    }
    this.updated_at = new Date();
  }

  /**
   * Mark exercise as rejected
   * @param {string} message - Rejection reason
   */
  reject(message) {
    this.validation_status = 'rejected';
    this.validation_message = message;
    this.updated_at = new Date();
  }
}

