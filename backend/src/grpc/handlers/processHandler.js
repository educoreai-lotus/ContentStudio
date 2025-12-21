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

    // Data is now an object with { courses: [], stand_alone_topics: [] }
    // Wrap it in items array for batch sync format
    const coursesCount = data.courses?.length || 0;
    const topicsCount = data.stand_alone_topics?.length || 0;
    const totalRecords = coursesCount + topicsCount;

    logger.info('[Batch Sync] Data fetched', {
      service: process.env.SERVICE_NAME || 'content-studio',
      tenant_id,
      page,
      courses: coursesCount,
      stand_alone_topics: topicsCount,
      total_records: totalRecords,
      total: totalCount,
      has_more: hasMore,
    });

    // ⚠️ CRITICAL: Return format MUST be { items: [...] }
    // Wrap the data object in an array since it contains both courses and stand_alone_topics
    return {
      data: {
        items: [data], // ⭐ Single object containing courses and stand_alone_topics arrays
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
   * Extract text from content_data JSONB object
   * Only extracts the "text" field as a string for content_type_id = 1 (text_audio)
   */
  extractTextFromContentData(contentData) {
    if (!contentData) return null;
    
    // If it's already a string, return it
    if (typeof contentData === 'string') {
      try {
        const parsed = JSON.parse(contentData);
        return parsed?.text || null;
      } catch {
        return contentData;
      }
    }
    
    // If it's an object, extract the text field
    if (typeof contentData === 'object') {
      return contentData.text || null;
    }
    
    return null;
  }

  /**
   * Query database with pagination (for Batch Sync)
   * Returns courses with their topics and content, plus stand-alone topics
   * Structure: { courses: [...], stand_alone_topics: [...] }
   */
  async queryDatabase({ tenant_id, limit, offset, since }) {
    await db.ready;

    if (!db.isConnected()) {
      logger.error('[Database Query] Database not connected');
      return { courses: [], stand_alone_topics: [] };
    }

    try {
      // Build where clause for courses - handle both Full Sync and Incremental Sync
      const courseParams = [];
      const courseWhereConditions = [];
      let courseParamIndex = 1;

      // Status filter: 'active' or 'archived' (exclude 'deleted')
      courseWhereConditions.push(`c.status IN ($${courseParamIndex}, $${courseParamIndex + 1})`);
      courseParams.push('active', 'archived');
      courseParamIndex += 2;

      if (tenant_id) {
        courseWhereConditions.push(`c.trainer_id = $${courseParamIndex}`);
        courseParams.push(tenant_id);
        courseParamIndex++;
      }

      // Incremental Sync: Check BOTH created_at AND updated_at
      if (since) {
        const sinceDate = new Date(since);
        courseWhereConditions.push(`(c.created_at >= $${courseParamIndex} OR c.updated_at >= $${courseParamIndex})`);
        courseParams.push(sinceDate);
        courseParamIndex++;
      }

      // Query courses first (without topics)
      const limitParamIndex = courseParamIndex;
      const offsetParamIndex = courseParamIndex + 1;
      courseParams.push(limit, offset);

      let courseQuery = `
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
          c.updated_at
        FROM trainer_courses c
        WHERE ${courseWhereConditions.join(' AND ')}
        ORDER BY c.updated_at DESC
        LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
      `;

      const courseResult = await db.query(courseQuery, courseParams);
      const courseIds = courseResult.rows.map(row => row.course_id);

      // Query topics for these courses
      let topicsForCourses = [];
      if (courseIds.length > 0) {
        const topicParams = [];
        const topicWhereConditions = [`t.course_id = ANY($1::INTEGER[])`, `t.status IN ($2, $3)`];
        topicParams.push(courseIds, 'active', 'archived');
        let topicParamIndex = 4;

        // Incremental Sync: Check BOTH created_at AND updated_at
        if (since) {
          const sinceDate = new Date(since);
          topicWhereConditions.push(`(t.created_at >= $${topicParamIndex} OR t.updated_at >= $${topicParamIndex})`);
          topicParams.push(sinceDate);
        }

        const topicQuery = `
          SELECT 
            t.topic_id,
            t.topic_name,
            t.description,
            t.trainer_id,
            t.language,
            t.status,
            t.skills,
            t.template_id,
            t.generation_methods_id,
            t.usage_count,
            t.devlab_exercises,
            t.created_at,
            t.updated_at,
            t.course_id
          FROM topics t
          WHERE ${topicWhereConditions.join(' AND ')}
          ORDER BY t.created_at DESC
        `;

        const topicResult = await db.query(topicQuery, topicParams);
        topicsForCourses = topicResult.rows;
      }

      // Group topics by course_id
      const topicsByCourseId = new Map();
      topicsForCourses.forEach(topic => {
        const courseId = topic.course_id;
        if (!topicsByCourseId.has(courseId)) {
          topicsByCourseId.set(courseId, []);
        }
        topicsByCourseId.get(courseId).push(topic);
      });

      // Process courses to include content for each topic
      const courses = await Promise.all(
        courseResult.rows.map(async (row) => {
          const courseTopics = topicsByCourseId.get(row.course_id) || [];
          const topicsWithContent = await Promise.all(
            courseTopics.map(async (topic) => {
              // Query content for this topic - ONLY content_type_id = 1 (text_audio)
              const contentParams = [topic.topic_id];
              let contentQuery = `
                SELECT 
                  content_id,
                  content_type_id,
                  content_data,
                  generation_method_id,
                  quality_check_status,
                  quality_check_data,
                  quality_checked_at,
                  created_at,
                  updated_at
                FROM content
                WHERE topic_id = $1
                  AND content_type_id = 1
              `;
              
              // Incremental Sync: Check BOTH created_at AND updated_at
              if (since) {
                contentQuery += ` AND (created_at >= $2 OR updated_at >= $2)`;
                contentParams.push(new Date(since));
              }
              
              contentQuery += ` ORDER BY created_at DESC`;
              
              const contentResult = await db.query(contentQuery, contentParams);
              
              // Extract only the text field from content_data
              const content = contentResult.rows.map((contentRow) => ({
                content_id: contentRow.content_id,
                content_type_id: contentRow.content_type_id,
                content_data: this.extractTextFromContentData(contentRow.content_data), // Extract only text
                generation_method_id: contentRow.generation_method_id,
                quality_check_status: contentRow.quality_check_status,
                quality_check_data: contentRow.quality_check_data,
                quality_checked_at: contentRow.quality_checked_at,
                created_at: contentRow.created_at,
                updated_at: contentRow.updated_at,
              }));

              return {
                topic_id: topic.topic_id,
                topic_name: topic.topic_name,
                description: topic.description || null,
                trainer_id: topic.trainer_id,
                language: topic.language,
                status: topic.status,
                skills: topic.skills || [],
                template_id: topic.template_id,
                generation_methods_id: topic.generation_methods_id,
                usage_count: topic.usage_count || 0,
                devlab_exercises: topic.devlab_exercises,
                created_at: topic.created_at,
                updated_at: topic.updated_at,
                content: content,
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

      // Query stand-alone topics (course_id IS NULL)
      const standaloneParams = [];
      const standaloneWhereConditions = ['t.course_id IS NULL'];
      let standaloneParamIndex = 1;

      // Status filter: 'active' or 'archived' (exclude 'deleted')
      standaloneWhereConditions.push(`t.status IN ($${standaloneParamIndex}, $${standaloneParamIndex + 1})`);
      standaloneParams.push('active', 'archived');
      standaloneParamIndex += 2;

      if (tenant_id) {
        standaloneWhereConditions.push(`t.trainer_id = $${standaloneParamIndex}`);
        standaloneParams.push(tenant_id);
        standaloneParamIndex++;
      }

      // Incremental Sync: Check BOTH created_at AND updated_at
      if (since) {
        const sinceDate = new Date(since);
        standaloneWhereConditions.push(`(t.created_at >= $${standaloneParamIndex} OR t.updated_at >= $${standaloneParamIndex})`);
        standaloneParams.push(sinceDate);
        standaloneParamIndex++;
      }

      const standaloneLimitParamIndex = standaloneParamIndex;
      const standaloneOffsetParamIndex = standaloneParamIndex + 1;
      standaloneParams.push(limit, offset);

      let standaloneQuery = `
        SELECT 
          t.topic_id,
          t.topic_name,
          t.description,
          t.trainer_id,
          t.language,
          t.status,
          t.skills,
          t.template_id,
          t.generation_methods_id,
          t.usage_count,
          t.devlab_exercises,
          t.created_at,
          t.updated_at
        FROM topics t
        WHERE ${standaloneWhereConditions.join(' AND ')}
        ORDER BY t.updated_at DESC
        LIMIT $${standaloneLimitParamIndex} OFFSET $${standaloneOffsetParamIndex}
      `;
      const standaloneResult = await db.query(standaloneQuery, standaloneParams);

      // Process stand-alone topics to include content
      const standAloneTopics = await Promise.all(
        standaloneResult.rows.map(async (topic) => {
          // Query content for this topic - ONLY content_type_id = 1 (text_audio)
          const contentParams = [topic.topic_id];
          let contentQuery = `
            SELECT 
              content_id,
              content_type_id,
              content_data,
              generation_method_id,
              quality_check_status,
              quality_check_data,
              quality_checked_at,
              created_at,
              updated_at
            FROM content
            WHERE topic_id = $1
              AND content_type_id = 1
          `;
          
          // Incremental Sync: Check BOTH created_at AND updated_at
          if (since) {
            contentQuery += ` AND (created_at >= $2 OR updated_at >= $2)`;
            contentParams.push(new Date(since));
          }
          
          contentQuery += ` ORDER BY created_at DESC`;
          
          const contentResult = await db.query(contentQuery, contentParams);
          
          // Extract only the text field from content_data
          const content = contentResult.rows.map((contentRow) => ({
            content_id: contentRow.content_id,
            content_type_id: contentRow.content_type_id,
            content_data: this.extractTextFromContentData(contentRow.content_data), // Extract only text
            generation_method_id: contentRow.generation_method_id,
            quality_check_status: contentRow.quality_check_status,
            quality_check_data: contentRow.quality_check_data,
            quality_checked_at: contentRow.quality_checked_at,
            created_at: contentRow.created_at,
            updated_at: contentRow.updated_at,
          }));

          return {
            topic_id: topic.topic_id,
            topic_name: topic.topic_name,
            description: topic.description || null,
            trainer_id: topic.trainer_id,
            language: topic.language,
            status: topic.status,
            skills: topic.skills || [],
            template_id: topic.template_id,
            generation_methods_id: topic.generation_methods_id,
            usage_count: topic.usage_count || 0,
            devlab_exercises: topic.devlab_exercises,
            created_at: topic.created_at,
            updated_at: topic.updated_at,
            content: content,
          };
        })
      );

      return {
        courses: courses,
        stand_alone_topics: standAloneTopics,
      };
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
   * Returns total count of courses + stand-alone topics
   */
  async getTotalCount({ tenant_id, since }) {
    await db.ready;

    if (!db.isConnected()) {
      return 0;
    }

    try {
      // Count courses
      const courseParams = [];
      const courseWhereConditions = ['status IN ($1, $2)']; // 'active' or 'archived'
      courseParams.push('active', 'archived');
      let courseParamIndex = 3;

      if (tenant_id) {
        courseWhereConditions.push(`trainer_id = $${courseParamIndex}`);
        courseParams.push(tenant_id);
        courseParamIndex++;
      }

      // Incremental Sync: Check BOTH created_at AND updated_at
      if (since) {
        const sinceDate = new Date(since);
        courseWhereConditions.push(`(created_at >= $${courseParamIndex} OR updated_at >= $${courseParamIndex})`);
        courseParams.push(sinceDate);
      }

      const courseQuery = `
        SELECT COUNT(*) as total
        FROM trainer_courses
        WHERE ${courseWhereConditions.join(' AND ')}
      `;

      const courseResult = await db.query(courseQuery, courseParams);
      const courseCount = parseInt(courseResult.rows[0].total, 10);

      // Count stand-alone topics
      const topicParams = [];
      const topicWhereConditions = ['course_id IS NULL', 'status IN ($1, $2)']; // 'active' or 'archived'
      topicParams.push('active', 'archived');
      let topicParamIndex = 3;

      if (tenant_id) {
        topicWhereConditions.push(`trainer_id = $${topicParamIndex}`);
        topicParams.push(tenant_id);
        topicParamIndex++;
      }

      // Incremental Sync: Check BOTH created_at AND updated_at
      if (since) {
        const sinceDate = new Date(since);
        topicWhereConditions.push(`(created_at >= $${topicParamIndex} OR updated_at >= $${topicParamIndex})`);
        topicParams.push(sinceDate);
      }

      const topicQuery = `
        SELECT COUNT(*) as total
        FROM topics
        WHERE ${topicWhereConditions.join(' AND ')}
      `;

      const topicResult = await db.query(topicQuery, topicParams);
      const topicCount = parseInt(topicResult.rows[0].total, 10);

      // Return sum of courses and stand-alone topics
      return courseCount + topicCount;
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

      // Get content for each topic - ONLY content_type_id = 1 (text_audio)
      const topicsWithContent = await Promise.all(
        topics.map(async (topic) => {
          // Query content - ONLY content_type_id = 1
          const contentQuery = `
            SELECT 
              content_id,
              content_type_id,
              content_data,
              generation_method_id,
              quality_check_status,
              quality_check_data,
              quality_checked_at,
              created_at,
              updated_at
            FROM content
            WHERE topic_id = $1
              AND content_type_id = 1
            ORDER BY created_at DESC
          `;
          
          const contentResult = await db.query(contentQuery, [topic.topic_id]);
          
          // Extract only the text field from content_data
          const content = contentResult.rows.map((contentRow) => ({
            content_id: contentRow.content_id,
            content_type_id: contentRow.content_type_id,
            content_data: this.extractTextFromContentData(contentRow.content_data), // Extract only text
            generation_method_id: contentRow.generation_method_id,
            quality_check_status: contentRow.quality_check_status,
            quality_check_data: contentRow.quality_check_data,
            quality_checked_at: contentRow.quality_checked_at,
            created_at: contentRow.created_at,
            updated_at: contentRow.updated_at,
          }));

          return {
            topic_id: topic.topic_id,
            topic_name: topic.topic_name,
            description: topic.description || null,
            trainer_id: topic.trainer_id,
            language: topic.language,
            status: topic.status,
            skills: topic.skills || [],
            template_id: topic.template_id,
            generation_methods_id: topic.generation_methods_id,
            usage_count: topic.usage_count || 0,
            devlab_exercises: topic.devlab_exercises,
            created_at: topic.created_at,
            updated_at: topic.updated_at,
            content: content,
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

      // Get content for this topic - ONLY content_type_id = 1 (text_audio)
      const contentQuery = `
        SELECT 
          content_id,
          content_type_id,
          content_data,
          generation_method_id,
          quality_check_status,
          quality_check_data,
          quality_checked_at,
          created_at,
          updated_at
        FROM content
        WHERE topic_id = $1
          AND content_type_id = 1
        ORDER BY created_at DESC
      `;
      
      const contentResult = await db.query(contentQuery, [topicId]);
      
      // Extract only the text field from content_data
      const content = contentResult.rows.map((contentRow) => ({
        content_id: contentRow.content_id,
        content_type_id: contentRow.content_type_id,
        content_data: this.extractTextFromContentData(contentRow.content_data), // Extract only text
        generation_method_id: contentRow.generation_method_id,
        quality_check_status: contentRow.quality_check_status,
        quality_check_data: contentRow.quality_check_data,
        quality_checked_at: contentRow.quality_checked_at,
        created_at: contentRow.created_at,
        updated_at: contentRow.updated_at,
      }));

      return {
        topic_id: topic.topic_id,
        topic_name: topic.topic_name,
        description: topic.description || null,
        trainer_id: topic.trainer_id,
        language: topic.language,
        status: topic.status,
        skills: topic.skills || [],
        template_id: topic.template_id,
        generation_methods_id: topic.generation_methods_id,
        usage_count: topic.usage_count || 0,
        devlab_exercises: topic.devlab_exercises,
        created_at: topic.created_at,
        updated_at: topic.updated_at,
        content: content,
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

