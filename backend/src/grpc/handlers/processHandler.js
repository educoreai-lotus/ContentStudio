import { logger } from '../../infrastructure/logging/Logger.js';
import { PostgreSQLCourseRepository } from '../../infrastructure/database/repositories/PostgreSQLCourseRepository.js';
import { PostgreSQLTopicRepository } from '../../infrastructure/database/repositories/PostgreSQLTopicRepository.js';
import { PostgreSQLContentRepository } from '../../infrastructure/database/repositories/PostgreSQLContentRepository.js';
import { db } from '../../infrastructure/database/DatabaseConnection.js';

/**
 * Process RPC Handler
 * Handles both Real-time queries and Batch sync requests for Content Studio
 */
class ProcessHandler {
  constructor() {
    this.courseRepository = new PostgreSQLCourseRepository();
    this.topicRepository = new PostgreSQLTopicRepository();
    this.contentRepository = new PostgreSQLContentRepository();
  }

  /**
   * Handle Process RPC call
   * @param {Object} call - GRPC call object
   * @param {Function} callback - Response callback
   */
  async handle(call, callback) {
    const startTime = Date.now();
    let envelope;

    try {
      // 1. Parse envelope from request
      const envelopeJson = call.request.envelope_json;
      envelope = JSON.parse(envelopeJson);

      const {
        request_id,
        tenant_id,
        user_id,
        target_service,
        payload,
        metadata,
      } = envelope;

      logger.info('[GRPC Process] Request received', {
        service: process.env.SERVICE_NAME || 'content-studio',
        request_id,
        tenant_id,
        user_id,
        target_service,
        has_payload: !!payload,
        sync_type: payload?.sync_type,
      });

      // 2. Detect mode: Real-time or Batch Sync
      const isBatchSync = payload?.sync_type === 'batch';

      let result;

      if (isBatchSync) {
        // ═══════════════════════════════════════
        // MODE 1: BATCH SYNC
        // ═══════════════════════════════════════
        logger.info('[GRPC Process - BATCH SYNC] Processing batch request', {
          service: process.env.SERVICE_NAME || 'content-studio',
          request_id,
          page: payload.page,
          limit: payload.limit,
          since: payload.since,
        });

        result = await this.handleBatchSync(envelope);
      } else {
        // ═══════════════════════════════════════
        // MODE 2: REAL-TIME QUERY
        // ═══════════════════════════════════════
        logger.info('[GRPC Process - REAL-TIME] Processing query', {
          service: process.env.SERVICE_NAME || 'content-studio',
          request_id,
          query: payload?.query,
          context: payload?.context,
        });

        result = await this.handleRealtimeQuery(envelope);
      }

      // 3. Build response envelope
      const responseEnvelope = {
        request_id,
        success: true,
        data: result.data, // ⚠️ CRITICAL: Must be array or {items: []}
        metadata: {
          ...(result.metadata || {}),
          processed_at: new Date().toISOString(),
          service: process.env.SERVICE_NAME || 'content-studio',
          duration_ms: Date.now() - startTime,
          mode: isBatchSync ? 'batch' : 'realtime',
        },
      };

      logger.info('[GRPC Process] Request completed', {
        service: process.env.SERVICE_NAME || 'content-studio',
        request_id,
        duration_ms: Date.now() - startTime,
        mode: isBatchSync ? 'batch' : 'realtime',
        success: true,
      });

      // 4. Return ProcessResponse
      callback(null, {
        success: true,
        envelope_json: JSON.stringify(responseEnvelope),
        error: '',
      });
    } catch (error) {
      logger.error('[GRPC Process] Request failed', {
        service: process.env.SERVICE_NAME || 'content-studio',
        request_id: envelope?.request_id,
        error: error.message,
        stack: error.stack,
        duration_ms: Date.now() - startTime,
      });

      // Return error response
      callback(null, {
        success: false,
        envelope_json: JSON.stringify({
          request_id: envelope?.request_id,
          success: false,
          error: error.message,
          metadata: {
            processed_at: new Date().toISOString(),
            service: process.env.SERVICE_NAME || 'content-studio',
          },
        }),
        error: error.message,
      });
    }
  }

  /**
   * Handle Batch Sync request
   * @param {Object} envelope - Request envelope
   * @returns {Promise<Object>} Result with data
   */
  async handleBatchSync(envelope) {
    const { tenant_id, payload } = envelope;

    const { page = 1, limit = 1000, since } = payload;

    logger.info('[Batch Sync] Fetching data', {
      service: process.env.SERVICE_NAME || 'content-studio',
      tenant_id,
      page,
      limit,
      since,
    });

    // Query database with pagination
    const offset = (page - 1) * limit;
    const data = await this.queryDatabase({
      tenant_id,
      limit,
      offset,
      since,
    });

    // Check if there are more records
    const totalCount = await this.getTotalCount({
      tenant_id,
      since,
    });
    const hasMore = page * limit < totalCount;

    logger.info('[Batch Sync] Data fetched', {
      service: process.env.SERVICE_NAME || 'content-studio',
      tenant_id,
      page,
      records: data.length,
      total: totalCount,
      has_more: hasMore,
    });

    // ⚠️ CRITICAL: Return format MUST be { items: [...] }
    return {
      data: {
        items: data, // ⭐ Your actual data array
        page,
        limit,
        total: totalCount,
      },
      metadata: {
        has_more: hasMore,
        page,
        total_pages: Math.ceil(totalCount / limit),
      },
    };
  }

  /**
   * Handle Real-time Query
   * @param {Object} envelope - Request envelope
   * @returns {Promise<Object>} Result with data
   */
  async handleRealtimeQuery(envelope) {
    const { tenant_id, user_id, payload } = envelope;

    const query = payload?.query || '';

    logger.info('[Real-time Query] Processing', {
      service: process.env.SERVICE_NAME || 'content-studio',
      tenant_id,
      user_id,
      query,
    });

    // Parse query and execute appropriate action
    let data;

    if (query.includes('recent') || query.includes('latest')) {
      data = await this.getRecentItems(tenant_id, user_id);
    } else if (query.includes('course') && (query.includes('id') || query.match(/\d+/))) {
      const id = this.extractId(query);
      if (id) {
        data = await this.getCourseById(tenant_id, id);
      } else {
        data = await this.getDefaultData(tenant_id, user_id);
      }
    } else if (query.includes('topic') && (query.includes('id') || query.match(/\d+/))) {
      const id = this.extractId(query);
      if (id) {
        data = await this.getTopicById(tenant_id, id);
      } else {
        data = await this.getDefaultData(tenant_id, user_id);
      }
    } else {
      // Default action - return recent courses and topics
      data = await this.getDefaultData(tenant_id, user_id);
    }

    logger.info('[Real-time Query] Data fetched', {
      service: process.env.SERVICE_NAME || 'content-studio',
      tenant_id,
      user_id,
      records: Array.isArray(data) ? data.length : 1,
    });

    // ⚠️ CRITICAL: Return data as direct array (not wrapped!)
    return {
      data: Array.isArray(data) ? data : [data], // ⭐ Direct array of items
      metadata: {
        query_type: this.detectQueryType(query),
      },
    };
  }

  /**
   * Query database with pagination (for Batch Sync)
   * Returns courses with their topics and content
   */
  async queryDatabase({ tenant_id, limit, offset, since }) {
    await db.ready;

    if (!db.isConnected()) {
      logger.error('[Database Query] Database not connected');
      return [];
    }

    try {
      // Build query to get courses with topics and content
      let query = `
        SELECT 
          c.course_id,
          c.course_name,
          c.trainer_id,
          c.description,
          c.skills,
          c.language,
          c.status,
          c.company_logo,
          c.permissions,
          c.usage_count,
          c.created_at,
          c.updated_at,
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'topic_id', t.topic_id,
                'topic_name', t.topic_name,
                'description', t.description,
                'template_id', t.template_id,
                'skills', t.skills,
                'language', t.language,
                'status', t.status,
                'usage_count', t.usage_count,
                'devlab_exercises', t.devlab_exercises,
                'created_at', t.created_at,
                'updated_at', t.updated_at
              )
            ) FILTER (WHERE t.topic_id IS NOT NULL),
            '[]'::json
          ) as topics
        FROM trainer_courses c
        LEFT JOIN topics t ON c.course_id = t.course_id AND t.status = 'active'
        WHERE c.status = 'active'
      `;

      const params = [];
      let paramIndex = 1;

      if (tenant_id) {
        query += ` AND c.trainer_id = $${paramIndex}`;
        params.push(tenant_id);
        paramIndex++;
      }

      if (since) {
        query += ` AND c.updated_at >= $${paramIndex}`;
        params.push(new Date(since));
        paramIndex++;
      }

      query += `
        GROUP BY c.course_id
        ORDER BY c.updated_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      params.push(limit, offset);

      const result = await db.query(query, params);

      // Process results to include content for each topic
      const courses = await Promise.all(
        result.rows.map(async (row) => {
          const topics = row.topics || [];
          const topicsWithContent = await Promise.all(
            topics.map(async (topic) => {
              const contents = await this.contentRepository.findAllByTopicId(topic.topic_id);
              return {
                ...topic,
                contents: contents.map((content) => ({
                  content_id: content.content_id,
                  content_type_id: content.content_type_id,
                  content_data: content.content_data,
                  generation_method_id: content.generation_method_id,
                  quality_check_status: content.quality_check_status,
                  created_at: content.created_at,
                  updated_at: content.updated_at,
                })),
              };
            })
          );

          return {
            course_id: row.course_id,
            course_name: row.course_name,
            trainer_id: row.trainer_id,
            description: row.description,
            skills: row.skills,
            language: row.language,
            status: row.status,
            company_logo: row.company_logo,
            permissions: row.permissions,
            usage_count: row.usage_count,
            created_at: row.created_at,
            updated_at: row.updated_at,
            topics: topicsWithContent,
          };
        })
      );

      return courses;
    } catch (error) {
      logger.error('[Database Query] Error querying database', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get total count (for Batch Sync pagination)
   */
  async getTotalCount({ tenant_id, since }) {
    await db.ready;

    if (!db.isConnected()) {
      return 0;
    }

    try {
      let query = `
        SELECT COUNT(*) as total
        FROM trainer_courses
        WHERE status = 'active'
      `;

      const params = [];
      let paramIndex = 1;

      if (tenant_id) {
        query += ` AND trainer_id = $${paramIndex}`;
        params.push(tenant_id);
        paramIndex++;
      }

      if (since) {
        query += ` AND updated_at >= $${paramIndex}`;
        params.push(new Date(since));
      }

      const result = await db.query(query, params);
      return parseInt(result.rows[0].total, 10);
    } catch (error) {
      logger.error('[Database Query] Error getting total count', {
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Get recent items (for Real-time queries)
   */
  async getRecentItems(tenant_id, user_id) {
    await db.ready;

    if (!db.isConnected()) {
      return [];
    }

    try {
      // Get recent courses (limit 10)
      const courses = await this.courseRepository.findAll(
        { trainer_id: tenant_id || user_id },
        { limit: 10, offset: 0 }
      );

      // Get recent topics (limit 10)
      const topics = await this.topicRepository.findAll(
        { trainer_id: tenant_id || user_id },
        { limit: 10, offset: 0 }
      );

      return [
        ...courses.map((course) => ({
          type: 'course',
          course_id: course.course_id,
          course_name: course.course_name,
          trainer_id: course.trainer_id,
          description: course.description,
          skills: course.skills,
          language: course.language,
          created_at: course.created_at,
          updated_at: course.updated_at,
        })),
        ...topics.map((topic) => ({
          type: 'topic',
          topic_id: topic.topic_id,
          topic_name: topic.topic_name,
          trainer_id: topic.trainer_id,
          course_id: topic.course_id,
          description: topic.description,
          skills: topic.skills,
          language: topic.language,
          created_at: topic.created_at,
          updated_at: topic.updated_at,
        })),
      ];
    } catch (error) {
      logger.error('[Real-time Query] Error getting recent items', {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Get course by ID (for Real-time queries)
   */
  async getCourseById(tenant_id, courseId) {
    await db.ready;

    if (!db.isConnected()) {
      return null;
    }

    try {
      const course = await this.courseRepository.findById(courseId);
      if (!course || (tenant_id && course.trainer_id !== tenant_id)) {
        return null;
      }

      // Get topics for this course
      const topics = await this.topicRepository.findByCourseId(courseId);

      // Get content for each topic
      const topicsWithContent = await Promise.all(
        topics.map(async (topic) => {
          const contents = await this.contentRepository.findAllByTopicId(topic.topic_id);
          return {
            topic_id: topic.topic_id,
            topic_name: topic.topic_name,
            description: topic.description,
            skills: topic.skills,
            language: topic.language,
            devlab_exercises: topic.devlab_exercises,
            contents: contents.map((content) => ({
              content_id: content.content_id,
              content_type_id: content.content_type_id,
              content_data: content.content_data,
              generation_method_id: content.generation_method_id,
              quality_check_status: content.quality_check_status,
            })),
          };
        })
      );

      return {
        course_id: course.course_id,
        course_name: course.course_name,
        trainer_id: course.trainer_id,
        description: course.description,
        skills: course.skills,
        language: course.language,
        company_logo: course.company_logo,
        permissions: course.permissions,
        usage_count: course.usage_count,
        created_at: course.created_at,
        updated_at: course.updated_at,
        topics: topicsWithContent,
      };
    } catch (error) {
      logger.error('[Real-time Query] Error getting course by ID', {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Get topic by ID (for Real-time queries)
   */
  async getTopicById(tenant_id, topicId) {
    await db.ready;

    if (!db.isConnected()) {
      return null;
    }

    try {
      const topic = await this.topicRepository.findById(topicId);
      if (!topic || (tenant_id && topic.trainer_id !== tenant_id)) {
        return null;
      }

      // Get content for this topic
      const contents = await this.contentRepository.findAllByTopicId(topicId);

      return {
        topic_id: topic.topic_id,
        topic_name: topic.topic_name,
        trainer_id: topic.trainer_id,
        course_id: topic.course_id,
        description: topic.description,
        skills: topic.skills,
        language: topic.language,
        devlab_exercises: topic.devlab_exercises,
        created_at: topic.created_at,
        updated_at: topic.updated_at,
        contents: contents.map((content) => ({
          content_id: content.content_id,
          content_type_id: content.content_type_id,
          content_data: content.content_data,
          generation_method_id: content.generation_method_id,
          quality_check_status: content.quality_check_status,
        })),
      };
    } catch (error) {
      logger.error('[Real-time Query] Error getting topic by ID', {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Get default data (for Real-time queries)
   */
  async getDefaultData(tenant_id, user_id) {
    return await this.getRecentItems(tenant_id, user_id);
  }

  /**
   * Extract ID from query text
   */
  extractId(query) {
    const match = query.match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
  }

  /**
   * Detect query type
   */
  detectQueryType(query) {
    if (query.includes('recent') || query.includes('latest')) return 'recent';
    if (query.includes('course')) return 'by_course_id';
    if (query.includes('topic')) return 'by_topic_id';
    return 'default';
  }
}

export default new ProcessHandler();

