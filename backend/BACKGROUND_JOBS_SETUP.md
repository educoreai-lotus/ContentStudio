# Background Jobs Setup

## Overview

The Content Studio backend includes a job scheduler system for running periodic background tasks, primarily for language management and content preloading.

## Jobs

### 1. Language Evaluation Job
**Schedule:** Every 2 weeks (1st and 15th of month at 2 AM UTC)
**Purpose:** 
- Evaluates language usage statistics
- Promotes/demotes languages based on frequency
- Triggers cleanup job automatically

**Cron Pattern:** `0 2 1,15 * *`

### 2. Language Cleanup Job
**Schedule:** Runs automatically after Language Evaluation
**Purpose:**
- Removes outdated content for non-frequent languages from Supabase Storage
- Optimizes storage space
- Keeps only recent/most-used content

### 3. Preload Frequent Languages Job
**Schedule:** Daily at 3 AM UTC, and on server startup
**Purpose:**
- Preloads content for frequent languages (en, he, ar) into Supabase Storage
- Ensures fast access to popular content
- Translates existing content if needed

**Cron Pattern:** `0 3 * * *`

## Setup

### Installation

The job scheduler uses `node-cron` for scheduling:

```bash
npm install node-cron
```

### Configuration

#### Environment Variables

```env
# Enable/disable background jobs (default: true)
ENABLE_BACKGROUND_JOBS=true

# Supabase (required for preload and cleanup)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI APIs (required for translation in preload)
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key  # Optional, uses OpenAI if not provided
```

### Starting Jobs

Jobs are automatically started when the server starts (if `ENABLE_BACKGROUND_JOBS` is not `false`):

```javascript
// In server.js
const scheduler = getJobScheduler();
await scheduler.start();
```

### Manual Control

#### Get Job Status
```http
GET /api/jobs/status
```

Response:
```json
{
  "success": true,
  "data": {
    "isRunning": true,
    "jobs": [
      {
        "name": "Language Evaluation",
        "schedule": "0 2 1,15 * *",
        "isActive": true
      },
      {
        "name": "Preload Frequent Languages",
        "schedule": "0 3 * * *",
        "isActive": true
      }
    ]
  }
}
```

#### Manually Trigger Job
```http
POST /api/jobs/trigger/evaluation
```

**Note:** This endpoint should be protected with admin authentication in production.

## Job Details

### Language Evaluation Orchestrator

The evaluation orchestrator coordinates:
1. **LanguageStatsJob** - Evaluates and promotes/demotes languages
2. **LanguageCleanupJob** - Cleans up Supabase Storage

Flow:
```
Scheduled Trigger
    ↓
[LanguageStatsJob]
    ↓
Recalculate frequency
    ↓
Promote/demote languages
    ↓
[LanguageCleanupJob]
    ↓
Remove non-frequent content
    ↓
Complete
```

### Preload Job

The preload job:
1. Gets all frequent languages
2. For each language:
   - Checks if content exists in Supabase
   - If not, translates from source (English)
   - Stores in Supabase Storage
3. Logs results

## Monitoring

### Logs

Jobs log their execution:
- Start time
- Progress
- Results
- Errors

Example log:
```
========================================
Starting Language Evaluation Cycle
========================================

[Step 1/2] Evaluating language statistics...
Language evaluation completed: {
  evaluation_date: "2024-01-15T02:00:00.000Z",
  total_languages: 12,
  frequent_languages: 3,
  demoted_languages: 2
}

[Step 2/2] Cleaning up Supabase Storage...
Language cleanup completed: {
  cleaned_languages: 2,
  total_cleaned_lessons: 15
}

========================================
Language Evaluation Cycle Completed
========================================
```

### Error Handling

Jobs include error handling:
- Errors are logged but don't crash the server
- Failed jobs can be retried manually
- Alerts can be configured (TODO)

## Production Considerations

### 1. Timezone
Jobs run in UTC. Adjust cron patterns if needed:
```javascript
cron.schedule('0 2 1,15 * *', fn, {
  timezone: 'America/New_York', // Example
});
```

### 2. Redis for BullMQ (Alternative)
If using BullMQ instead of node-cron:
```javascript
import { Queue } from 'bullmq';

const languageEvaluationQueue = new Queue('language-evaluation', {
  connection: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
});

languageEvaluationQueue.add('evaluate', {}, {
  repeat: { cron: '0 2 1,15 * *' },
});
```

### 3. Monitoring
- Set up monitoring for job execution
- Alert on job failures
- Track job execution times
- Monitor resource usage

### 4. Scaling
- Jobs run on a single instance
- For multi-instance deployments, use:
  - Distributed lock (Redis)
  - Leader election
  - External scheduler (Kubernetes CronJob)

## Testing

### Manual Trigger
```bash
curl -X POST http://localhost:3000/api/jobs/trigger/evaluation
```

### Check Status
```bash
curl http://localhost:3000/api/jobs/status
```

### Disable Jobs (Development)
```env
ENABLE_BACKGROUND_JOBS=false
```

## Troubleshooting

### Jobs Not Running
1. Check `ENABLE_BACKGROUND_JOBS` environment variable
2. Check server logs for errors
3. Verify cron patterns are valid
4. Check timezone settings

### Preload Failing
1. Verify Supabase credentials
2. Check OpenAI/Gemini API keys
3. Verify database connection
4. Check topic/content data exists

### Cleanup Not Working
1. Verify Supabase Storage access
2. Check language statistics are being tracked
3. Verify cleanup job runs after evaluation

## Future Enhancements

1. **Job History** - Store job execution history in database
2. **Retry Logic** - Automatic retry for failed jobs
3. **Notifications** - Send alerts on job completion/failure
4. **Web UI** - Admin interface for job management
5. **Metrics** - Track job performance and resource usage



