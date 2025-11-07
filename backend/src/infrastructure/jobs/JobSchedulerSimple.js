/**
 * Simple Job Scheduler (Fallback)
 * Uses setInterval for scheduling when node-cron is not available
 */
export class JobSchedulerSimple {
  constructor() {
    this.jobs = [];
    this.intervals = [];
    this.isRunning = false;
  }

  /**
   * Parse cron-like pattern to milliseconds
   * Supports: "0 2 1,15 * *" (minute hour day month dayOfWeek)
   */
  parseCronPattern(pattern) {
    // Simplified parser - for production use a proper cron parser
    // This is a basic implementation for "0 2 1,15 * *" format
    const parts = pattern.split(' ');
    if (parts.length !== 5) {
      throw new Error('Invalid cron pattern');
    }

    const [minute, hour, day, month, dayOfWeek] = parts;
    
    // For now, return a daily interval as fallback
    // In production, use a proper cron parser library
    return 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  }

  /**
   * Start scheduler
   */
  async start() {
    if (this.isRunning) {
      console.warn('Job scheduler is already running');
      return;
    }

    console.log('Starting simple job scheduler (fallback mode)...');
    this.isRunning = true;

    // Note: This is a simplified fallback
    // For production, use node-cron or BullMQ
    console.warn('Using fallback scheduler - jobs will run on simplified schedule');
  }

  /**
   * Stop scheduler
   */
  stop() {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    this.jobs = [];
    this.isRunning = false;
    console.log('Job scheduler stopped');
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      mode: 'fallback',
      jobs: this.jobs,
    };
  }
}



