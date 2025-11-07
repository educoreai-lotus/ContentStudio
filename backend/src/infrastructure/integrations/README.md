# Microservice Integration Layer

This directory contains all integration clients for communicating with other EduCore microservices.

## Architecture

- **gRPC Clients**: For Course Builder, Skills Engine, Directory, DevLab
- **REST Clients**: For Learning Analytics, RAG (Contextual Assistant)

## Integration Clients

### 1. SkillsEngineClient (gRPC)
- **Purpose**: Get skills mapping for topics
- **Methods**:
  - `getSkillsMapping(trainerId, topicName)` - Get micro/nano skills for a topic
  - `validateSkillsPermissions(trainerId, skills)` - Validate trainer permissions

### 2. CourseBuilderClient (gRPC)
- **Purpose**: Send course structures and handle personalized course requests
- **Methods**:
  - `sendCourseStructure(courseData)` - Send trainer-customized course
  - `handlePersonalizedCourseRequest(requestData)` - Handle learner-customized course

### 3. DevLabClient (gRPC)
- **Purpose**: Generate and validate programming exercises
- **Methods**:
  - `generateExercises(exerciseRequest)` - Generate AI exercises
  - `validateExercise(exerciseData)` - Validate trainer-created exercises

### 4. DirectoryClient (gRPC)
- **Purpose**: Sync trainer/course information (reversed flow)
- **Methods**:
  - `receiveTrainerInfo(trainerInfo)` - Receive trainer info from Directory
  - `syncCourseToDirectory(courseData)` - Send course updates to Directory
  - `validateTrainer(trainerId)` - Validate trainer permissions

### 5. LearningAnalyticsClient (REST)
- **Purpose**: Send metrics and analytics data
- **Methods**:
  - `sendMetrics(metrics)` - Send aggregated metrics
  - `sendContentMetrics(contentMetrics)` - Send per-content metrics

### 6. RAGClient (REST)
- **Purpose**: Index content for semantic search
- **Methods**:
  - `indexContent(contentData)` - Index approved content
  - `updateIndexedContent(contentId, updates)` - Update indexed content

## Usage

```javascript
import { IntegrationServiceManager } from './IntegrationServiceManager.js';

// Initialize manager
const integrationManager = new IntegrationServiceManager({
  skillsEngineConfig: { serviceUrl: 'skills-engine:50051' },
  courseBuilderConfig: { serviceUrl: 'course-builder:50051' },
  // ... other configs
});

// Use clients
const skillsEngine = integrationManager.getSkillsEngine();
const skills = await skillsEngine.getSkillsMapping('trainer123', 'JavaScript Basics');
```

## Current Status

- ✅ **Client Structure**: All clients implemented with interfaces
- ⏳ **gRPC Implementation**: Placeholder - needs actual gRPC client setup
- ⏳ **REST Implementation**: Placeholder - needs HTTP client (Axios) setup
- ✅ **Mock Responses**: Working for development/testing
- ⏳ **Production Ready**: Requires actual service URLs and authentication

## Next Steps

1. Install gRPC dependencies: `@grpc/grpc-js`, `@grpc/proto-loader`
2. Create `.proto` files for gRPC services
3. Implement actual gRPC client connections
4. Install Axios for REST clients
5. Add authentication/authorization
6. Add retry logic and error handling
7. Add connection pooling

## Environment Variables

```env
# gRPC Service URLs
SKILLS_ENGINE_URL=skills-engine:50051
COURSE_BUILDER_URL=course-builder:50051
DEVLAB_URL=devlab:50051
DIRECTORY_URL=directory:50051

# REST Service URLs
LEARNING_ANALYTICS_URL=http://learning-analytics:3000
RAG_URL=http://rag:3000
```



