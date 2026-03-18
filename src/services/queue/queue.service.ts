import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import { getRedis } from '../../config/redis';
import { loggers } from '../../utils/logger';

/**
 * Queue configuration
 */
const QUEUE_CONFIG = {
  connection: getRedis(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: 100,
    removeOnFail: 50
  }
};

/**
 * Queue names for different types of jobs
 */
export const QUEUE_NAMES = {
  TASK_ASSIGNMENT: 'task-assignment',
  COMMENT_SUMMARY: 'comment-summary',
  DAILY_DIGEST: 'daily-digest',
  FOCUS_ANALYSIS: 'focus-analysis',
  TASK_EXPLANATION: 'task-explanation',
  TASK_SYNC: 'task-sync',
  WEBHOOK_PROCESSING: 'webhook-processing'
} as const;

/**
 * Queue instances
 */
const queues = new Map<string, Queue>();
const workers = new Map<string, Worker>();
const queueEvents = new Map<string, QueueEvents>();

/**
 * Create or get a queue
 */
export function getQueue(name: string): Queue {
  if (!queues.has(name)) {
    const queue = new Queue(name, QUEUE_CONFIG);
    queues.set(name, queue);
    
    // Set up queue events
    const qEvents = new QueueEvents(name, { connection: getRedis() });
    queueEvents.set(name, qEvents);
    
    qEvents.on('completed', ({ jobId, returnvalue }) => {
      loggers.queue(name, 'completed', jobId);
    });
    
    qEvents.on('failed', ({ jobId, failedReason }) => {
      loggers.queue(name, 'failed', jobId, new Error(failedReason));
    });
    
    qEvents.on('stalled', ({ jobId }) => {
      loggers.queue(name, 'stalled', jobId);
    });
  }
  
  return queues.get(name)!;
}

/**
 * Create a worker for processing jobs
 */
export function createWorker(
  queueName: string,
  processor: (job: Job) => Promise<any>,
  options: {
    concurrency?: number;
    limiter?: {
      max: number;
      duration: number;
    };
  } = {}
): Worker {
  if (workers.has(queueName)) {
    return workers.get(queueName)!;
  }

  const worker = new Worker(
    queueName,
    processor,
    {
      connection: getRedis(),
      concurrency: options.concurrency || 5,
      limiter: options.limiter || {
        max: 10,
        duration: 60000 // 1 minute
      },
      ...QUEUE_CONFIG.defaultJobOptions
    }
  );

  // Set up worker events
  worker.on('completed', (job) => {
    loggers.queue(queueName, 'job completed', job.id);
  });

  worker.on('failed', (job, err) => {
    loggers.queue(queueName, 'job failed', job?.id, err);
  });

  worker.on('error', (err) => {
    loggers.queue(queueName, 'worker error', undefined, err);
  });

  workers.set(queueName, worker);
  return worker;
}

/**
 * Add a job to a queue
 */
export async function addJob(
  queueName: string,
  jobName: string,
  data: any,
  options: {
    delay?: number;
    priority?: number;
    attempts?: number;
    backoff?: any;
  } = {}
): Promise<Job> {
  const queue = getQueue(queueName);
  
  return queue.add(jobName, data, {
    ...options,
    ...QUEUE_CONFIG.defaultJobOptions
  });
}

/**
 * Get job status
 */
export async function getJobStatus(queueName: string, jobId: string): Promise<{
  id: string;
  name: string;
  data: any;
  progress: number;
  processedOn: number | null;
  finishedOn: number | null;
  failedReason: string | null;
  returnvalue: any;
} | null> {
  const queue = getQueue(queueName);
  const job = await queue.getJob(jobId);
  
  if (!job) {
    return null;
  }

  return {
    id: job.id!,
    name: job.name!,
    data: job.data,
    progress: job.progress,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    failedReason: job.failedReason,
    returnvalue: job.returnvalue
  };
}

/**
 * Get queue statistics
 */
export async function getQueueStats(queueName: string): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}> {
  const queue = getQueue(queueName);
  
  const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
    queue.getWaiting(),
    queue.getActive(),
    queue.getCompleted(),
    queue.getFailed(),
    queue.getDelayed(),
    queue.getPaused()
  ]);

  return {
    waiting: waiting.length,
    active: active.length,
    completed: completed.length,
    failed: failed.length,
    delayed: delayed.length,
    paused: paused.length
  };
}

/**
 * Pause a queue
 */
export async function pauseQueue(queueName: string): Promise<void> {
  const queue = getQueue(queueName);
  await queue.pause();
  loggers.queue(queueName, 'paused');
}

/**
 * Resume a queue
 */
export async function resumeQueue(queueName: string): Promise<void> {
  const queue = getQueue(queueName);
  await queue.resume();
  loggers.queue(queueName, 'resumed');
}

/**
 * Clear a queue
 */
export async function clearQueue(queueName: string): Promise<void> {
  const queue = getQueue(queueName);
  await queue.drain();
  loggers.queue(queueName, 'cleared');
}

/**
 * Close all queues and workers
 */
export async function closeAll(): Promise<void> {
  const closePromises: Promise<void>[] = [];

  // Close workers
  for (const [name, worker] of workers) {
    closePromises.push(worker.close().then(() => {
      loggers.queue(name, 'worker closed');
    }));
  }

  // Close queues
  for (const [name, queue] of queues) {
    closePromises.push(queue.close().then(() => {
      loggers.queue(name, 'queue closed');
    }));
  }

  // Close queue events
  for (const [name, events] of queueEvents) {
    closePromises.push(events.close().then(() => {
      loggers.queue(name, 'queue events closed');
    }));
  }

  await Promise.all(closePromises);
  
  // Clear maps
  workers.clear();
  queues.clear();
  queueEvents.clear();
}

/**
 * Queue service for high-level operations
 */
export class QueueService {
  /**
   * Initialize all queues and workers
   */
  static async initialize(): Promise<void> {
    // Import processors dynamically to avoid circular dependencies
    const { TaskAssignmentProcessor } = await import('./processors/task-assignment.processor');
    const { CommentSummaryProcessor } = await import('./processors/comment-summary.processor');
    const { DailyDigestProcessor } = await import('./processors/daily-digest.processor');
    const { FocusAnalysisProcessor } = await import('./processors/focus-analysis.processor');
    const { TaskExplanationProcessor } = await import('./processors/task-explanation.processor');
    const { TaskSyncProcessor } = await import('./processors/task-sync.processor');
    const { WebhookProcessor } = await import('./processors/webhook.processor');

    // Create workers with appropriate concurrency
    createWorker(QUEUE_NAMES.TASK_ASSIGNMENT, TaskAssignmentProcessor.process, { concurrency: 10 });
    createWorker(QUEUE_NAMES.COMMENT_SUMMARY, CommentSummaryProcessor.process, { concurrency: 5 });
    createWorker(QUEUE_NAMES.DAILY_DIGEST, DailyDigestProcessor.process, { concurrency: 3 });
    createWorker(QUEUE_NAMES.FOCUS_ANALYSIS, FocusAnalysisProcessor.process, { concurrency: 5 });
    createWorker(QUEUE_NAMES.TASK_EXPLANATION, TaskExplanationProcessor.process, { concurrency: 5 });
    createWorker(QUEUE_NAMES.TASK_SYNC, TaskSyncProcessor.process, { concurrency: 2 });
    createWorker(QUEUE_NAMES.WEBHOOK_PROCESSING, WebhookProcessor.process, { concurrency: 15 });

    loggers.queue('queue-service', 'initialized');
  }

  /**
   * Add task assignment job
   */
  static async addTaskAssignment(data: {
    tenantId: string;
    taskId: string;
    assigneeId: string;
    taskData: any;
  }): Promise<Job> {
    return addJob(QUEUE_NAMES.TASK_ASSIGNMENT, 'notify-assignment', data, {
      priority: 10 // High priority
    });
  }

  /**
   * Add comment summary job
   */
  static async addCommentSummary(data: {
    tenantId: string;
    taskId: string;
    taskName: string;
    comments: any[];
  }): Promise<Job> {
    return addJob(QUEUE_NAMES.COMMENT_SUMMARY, 'summarize-comments', data, {
      priority: 5 // Medium priority
    });
  }

  /**
   * Add daily digest job (scheduled)
   */
  static async addDailyDigest(data: {
    tenantId: string;
    userId: string;
    tasks: any[];
    userPreferences: any;
  }): Promise<Job> {
    return addJob(QUEUE_NAMES.DAILY_DIGEST, 'generate-digest', data, {
      priority: 3 // Lower priority
    });
  }

  /**
   * Add focus analysis job
   */
  static async addFocusAnalysis(data: {
    tenantId: string;
    userId: string;
    tasks: any[];
    userPreferences: any;
  }): Promise<Job> {
    return addJob(QUEUE_NAMES.FOCUS_ANALYSIS, 'analyze-focus', data, {
      priority: 7 // High priority
    });
  }

  /**
   * Add task explanation job
   */
  static async addTaskExplanation(data: {
    tenantId: string;
    userId: string;
    taskId: string;
    taskData: any;
  }): Promise<Job> {
    return addJob(QUEUE_NAMES.TASK_EXPLANATION, 'explain-task', data, {
      priority: 6 // Medium-high priority
    });
  }

  /**
   * Add task sync job
   */
  static async addTaskSync(data: {
    tenantId: string;
    taskId?: string;
    maxAgeMinutes?: number;
  }): Promise<Job> {
    return addJob(QUEUE_NAMES.TASK_SYNC, 'sync-tasks', data, {
      priority: 1 // Low priority
    });
  }

  /**
   * Add webhook processing job
   */
  static async addWebhookProcessing(data: {
    tenantId: string;
    webhookType: 'clickup' | 'slack';
    payload: any;
  }): Promise<Job> {
    return addJob(QUEUE_NAMES.WEBHOOK_PROCESSING, 'process-webhook', data, {
      priority: 10 // High priority
    });
  }

  /**
   * Get all queue statistics
   */
  static async getAllStats(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};
    
    for (const queueName of Object.values(QUEUE_NAMES)) {
      stats[queueName] = await getQueueStats(queueName);
    }
    
    return stats;
  }

  /**
   * Health check for all queues
   */
  static async healthCheck(): Promise<{
    healthy: boolean;
    queues: Record<string, boolean>;
    workers: Record<string, boolean>;
  }> {
    const result = {
      healthy: true,
      queues: {} as Record<string, boolean>,
      workers: {} as Record<string, boolean>
    };

    // Check queues
    for (const queueName of Object.values(QUEUE_NAMES)) {
      try {
        const queue = getQueue(queueName);
        await queue.getJobCounts();
        result.queues[queueName] = true;
      } catch (error) {
        result.queues[queueName] = false;
        result.healthy = false;
      }
    }

    // Check workers
    for (const [queueName, worker] of workers) {
      result.workers[queueName] = !worker.isClosing();
      if (worker.isClosing()) {
        result.healthy = false;
      }
    }

    return result;
  }
}
