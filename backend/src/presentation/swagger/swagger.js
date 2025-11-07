/**
 * Swagger/OpenAPI Configuration
 * 
 * To use: npm install swagger-ui-express swagger-jsdoc
 */

// Uncomment when swagger packages are installed
/*
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Content Studio API',
      version: '1.0.0',
      description: 'API documentation for Content Studio - EduCore AI microservice',
      contact: {
        name: 'EduCore AI',
        email: 'support@educore.ai',
      },
    },
    servers: [
      {
        url: process.env.API_BASE_URL || process.env.API_URL || '',
        description: 'Development server',
      },
      {
        url: 'https://api.educore.ai',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  example: 'VALIDATION_ERROR',
                },
                message: {
                  type: 'string',
                  example: 'Validation failed',
                },
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                },
              },
            },
          },
        },
        Course: {
          type: 'object',
          properties: {
            course_id: { type: 'integer' },
            course_name: { type: 'string' },
            description: { type: 'string' },
            created_by: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        Topic: {
          type: 'object',
          properties: {
            topic_id: { type: 'integer' },
            topic_name: { type: 'string' },
            course_id: { type: 'integer' },
            description: { type: 'string' },
            created_by: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Content: {
          type: 'object',
          properties: {
            content_id: { type: 'integer' },
            topic_id: { type: 'integer' },
            content_type_id: { type: 'string' },
            content_data: { type: 'object' },
            created_by: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Template: {
          type: 'object',
          properties: {
            template_id: { type: 'integer' },
            template_name: { type: 'string' },
            format_order: {
              type: 'array',
              items: { type: 'string' },
            },
            description: { type: 'string' },
            created_by: { type: 'string' },
          },
        },
      },
    },
  },
  apis: ['./src/presentation/routes/*.js', './src/presentation/controllers/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

export { swaggerUi, swaggerSpec };
*/

// Placeholder export for now
export const swaggerUi = null;
export const swaggerSpec = null;

