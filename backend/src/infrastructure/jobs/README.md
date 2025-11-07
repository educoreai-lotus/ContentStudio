# Background Jobs

## Language Evaluation System

### Overview

The language evaluation system operates in **two phases**:

1. **Real-time Statistics Collection**: Language usage statistics are updated immediately on each request (incrementing `total_requests`, updating `last_used`).

2. **Periodic Evaluation**: Language promotion/demotion happens **periodically** (every 2 weeks or monthly), NOT in real-time. This ensures:
   - Data-driven decisions based on collected statistics
   - Stable caching behavior
   - Protection against short-term fluctuations

### Jobs

#### 1. LanguageStatsJob
Recalculates language frequency and promotes/demotes languages based on collected usage statistics.

**Schedule:** Every 2 weeks (bi-weekly) or monthly

#### 2. LanguageCleanupJob
Removes outdated lesson content for non-frequent languages from Supabase Storage.

**Schedule:** Runs immediately after LanguageStatsJob

#### 3. LanguageEvaluationOrchestrator
Coordinates the complete evaluation cycle (evaluation + cleanup).

**Schedule:** Every 2 weeks (bi-weekly) or monthly

### Setup with Node-CRON (Recommended)

```javascript
import cron from 'node-cron';
import { LanguageEvaluationOrchestrator } from './LanguageEvaluationOrchestrator.js';
import { LanguageStatsRepository } from '../database/repositories/LanguageStatsRepository.js';
import { SupabaseStorageClient } from '../storage/SupabaseStorageClient.js';
import { RepositoryFactory } from '../database/repositories/RepositoryFactory.js';

// Initialize services
const languageStatsRepository = new LanguageStatsRepository();
const supabaseStorageClient = new SupabaseStorageClient({
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
});
const contentRepository = RepositoryFactory.getContentRepository();
const topicRepository = RepositoryFactory.getTopicRepository();

const orchestrator = new LanguageEvaluationOrchestrator({
  languageStatsRepository,
  supabaseStorageClient,
  contentRepository,
  topicRepository,
});

// Schedule: Every 2 weeks (1st and 15th of month at 2 AM)
cron.schedule('0 2 1,15 * *', async () => {
  console.log('Running scheduled language evaluation...');
  await orchestrator.execute();
});

// OR Monthly (1st of each month at 2 AM)
// cron.schedule('0 2 1 * *', async () => {
//   await orchestrator.execute();
// });
```

### Setup with BullMQ

```javascript
import Queue from 'bull';
import { LanguageEvaluationOrchestrator } from './LanguageEvaluationOrchestrator.js';

const languageEvaluationQueue = new Queue('language-evaluation', {
  redis: { host: process.env.REDIS_HOST || '', port: process.env.REDIS_PORT || 6379 },
});

// Initialize orchestrator
const orchestrator = new LanguageEvaluationOrchestrator({...});

// Process job
languageEvaluationQueue.process(async (job) => {
  return await orchestrator.execute();
});

// Schedule: Every 2 weeks (bi-weekly)
languageEvaluationQueue.add('evaluate', {}, {
  repeat: { cron: '0 2 1,15 * *' }, // 1st and 15th of month at 2 AM
});

// OR Monthly
// languageEvaluationQueue.add('evaluate', {}, {
//   repeat: { cron: '0 2 1 * *' }, // 1st of each month at 2 AM
// });
```

### Evaluation Flow

```
Scheduled Trigger (Every 2 weeks/month)
    ↓
[LanguageStatsJob]
    ↓
Recalculate frequency based on collected stats
    ↓
Promote languages (>5% threshold)
    ↓
Demote languages (<5% threshold, not predefined)
    ↓
[LanguageCleanupJob]
    ↓
Remove content from demoted languages in Supabase
    ↓
Keep only recent/most-used for non-frequent languages
    ↓
Complete
```

### Important Notes

- **Real-time updates**: Language statistics (`total_requests`, `last_used`) are updated immediately on each request.
- **Periodic evaluation**: Promotion/demotion decisions are made ONLY during scheduled evaluations.
- **Stable caching**: This ensures caching decisions are data-driven and not affected by short-term spikes.
- **Storage optimization**: Cleanup job runs after evaluation to optimize Supabase Storage space.

### Manual Execution

```javascript
// For testing or manual execution
const orchestrator = new LanguageEvaluationOrchestrator({...});
await orchestrator.execute();
```

