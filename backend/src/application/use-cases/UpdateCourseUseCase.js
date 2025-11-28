import { Course } from '../../domain/entities/Course.js';

export class UpdateCourseUseCase {
  constructor(courseRepository, topicRepository = null, contentRepository = null) {
    this.courseRepository = courseRepository;
    this.topicRepository = topicRepository;
    this.contentRepository = contentRepository;
  }

  async execute(courseId, updateData) {
    if (!courseId) {
      throw new Error('Course ID is required');
    }

    // Get existing course - use findByIdIncludingDeleted if we're updating status (for restore operations)
    // This allows us to restore deleted courses by updating their status to 'active'
    const isStatusUpdate = updateData.status !== undefined;
    const existingCourse = isStatusUpdate && this.courseRepository.findByIdIncludingDeleted
      ? await this.courseRepository.findByIdIncludingDeleted(courseId)
      : await this.courseRepository.findById(courseId);

    if (!existingCourse) {
      return null;
    }

    // If language is being updated, check if topics have content
    const isLanguageUpdate = updateData.language !== undefined && updateData.language !== existingCourse.language;
    if (isLanguageUpdate && this.topicRepository && this.contentRepository && updateData.language) {
      try {
        // Get all topics for this course
        const topics = await this.topicRepository.findAll({ course_id: courseId }, { page: 1, limit: 1000 });
        
        // Check if any topic has content
        const topicsWithContent = [];
        for (const topic of topics.topics || []) {
          try {
            const contentItems = await this.contentRepository.findAllByTopicId(topic.topic_id, {
              includeArchived: false,
            });
            if (contentItems && contentItems.length > 0) {
              topicsWithContent.push({
                topic_id: topic.topic_id,
                topic_name: topic.topic_name,
                content_count: contentItems.length,
              });
            }
          } catch (error) {
            console.warn('[UpdateCourseUseCase] Failed to check content for topic:', {
              topic_id: topic.topic_id,
              error: error.message,
            });
            // If we can't check, assume there might be content - be safe
            topicsWithContent.push({
              topic_id: topic.topic_id,
              topic_name: topic.topic_name,
              content_count: 'unknown',
            });
          }
        }

        // If any topic has content, prevent language update
        if (topicsWithContent.length > 0) {
          const error = new Error('Cannot change course language when topics contain content');
          error.code = 'LANGUAGE_UPDATE_BLOCKED';
          error.details = {
            course_id: courseId,
            current_language: existingCourse.language,
            requested_language: updateData.language,
            topics_with_content: topicsWithContent,
            message: 'Some topics in this course already have content. Please create a new course if you need a different language.',
          };
          throw error;
        }

        // No content found - safe to update language for all topics
        for (const topic of topics.topics || []) {
          try {
            await this.topicRepository.update(topic.topic_id, { language: updateData.language });
            console.log('[UpdateCourseUseCase] Updated topic language:', {
              topic_id: topic.topic_id,
              topic_name: topic.topic_name,
              new_language: updateData.language,
            });
          } catch (error) {
            console.warn('[UpdateCourseUseCase] Failed to update topic language:', {
              topic_id: topic.topic_id,
              error: error.message,
            });
            // Continue updating other topics even if one fails
          }
        }
        console.log('[UpdateCourseUseCase] Updated language for all topics in course:', {
          course_id: courseId,
          new_language: updateData.language,
          topics_updated: topics.topics?.length || 0,
        });
      } catch (error) {
        // Re-throw if it's our custom error
        if (error.code === 'LANGUAGE_UPDATE_BLOCKED') {
          throw error;
        }
        console.warn('[UpdateCourseUseCase] Failed to update topics language:', error.message);
        // Continue with course update even if topic updates fail (unless it's our custom error)
      }
    }

    // Persist update with only changed fields
    const savedCourse = await this.courseRepository.update(courseId, updateData);

    return savedCourse;
  }
}

