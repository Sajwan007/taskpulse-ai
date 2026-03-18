import { Job } from 'bullmq';
import { SlackService } from '../slack/slack.service';
import { ClickUpService } from '../clickup/clickup.service';
import { WorkflowService } from '../ai/sim.client';
import { Tenant } from '../../../models/Tenant.model';
import { User } from '../../../models/User.model';
import { loggers } from '../../../utils/logger';

/**
 * Process daily digest generation and delivery
 */
export class DailyDigestProcessor {
  private static slackService = new SlackService();
  private static clickupService = new ClickUpService();

  /**
   * Process a daily digest job
   */
  static async process(job: Job): Promise<any> {
    const { tenantId, userId } = job.data;
    
    try {
      loggers.queue('daily-digest', 'processing', job.id);

      // Get tenant and user details
      const tenant = await Tenant.findOne({ tenantId, status: 'active' });
      if (!tenant) {
        throw new Error(`Tenant not found: ${tenantId}`);
      }

      const user = await User.findOne({ tenantId, 'clickup.userId': userId });
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Check if daily digest is enabled for tenant and user
      if (!tenant.settings.features.dailyDigest || !user.preferences.dailyDigest) {
        loggers.slack('Daily digest disabled', tenantId, userId);
        return { skipped: true, reason: 'Daily digest disabled' };
      }

      // Get user's tasks from ClickUp
      const tasks = await this.clickupService.getUserTasks(tenantId, userId, {
        limit: 50 // Limit to recent tasks
      });

      if (!tasks || tasks.length === 0) {
        loggers.slack('No tasks found for digest', tenantId, userId);
        return { skipped: true, reason: 'No tasks found' };
      }

      // Categorize tasks
      const categorizedTasks = this.categorizeTasks(tasks);
      
      // Generate digest using Sim AI
      const digest = await WorkflowService.generateDailyDigest({
        tenantId,
        userId,
        tasks: categorizedTasks,
        userPreferences: user.preferences
      });

      // Send digest via Slack
      await this.slackService.sendDailyDigest({
        tenantId,
        userId,
        digest
      });

      // Update user activity
      await user.incrementActivity('general');

      loggers.slack('Daily digest sent successfully', tenantId, userId);
      return { 
        success: true, 
        tasksProcessed: tasks.length,
        categories: Object.keys(categorizedTasks).filter(key => categorizedTasks[key].length > 0)
      };

    } catch (error) {
      loggers.queue('daily-digest', 'processing failed', job.id, error as Error);
      throw error;
    }
  }

  /**
   * Categorize tasks based on priority and due dates
   */
  private static categorizeTasks(tasks: any[]): {
    highPriority: any[];
    dueToday: any[];
    overdue: any[];
    upcoming: any[];
    completed: any[];
  } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    const categorized = {
      highPriority: [] as any[],
      dueToday: [] as any[],
      overdue: [] as any[],
      upcoming: [] as any[],
      completed: [] as any[]
    };

    for (const task of tasks) {
      const dueDate = task.due_date ? new Date(parseInt(task.due_date)) : null;
      const priority = task.priority?.id || 3; // Default to normal priority
      const status = task.status?.status?.toLowerCase();

      // Skip completed tasks for most categories
      if (status === 'complete' || status === 'done') {
        categorized.completed.push(task);
        continue;
      }

      // High priority tasks
      if (priority <= 2) { // Urgent or High
        categorized.highPriority.push(task);
      }

      // Overdue tasks
      if (dueDate && dueDate < today) {
        categorized.overdue.push(task);
      }
      // Due today
      else if (dueDate && dueDate >= today && dueDate < tomorrow) {
        categorized.dueToday.push(task);
      }
      // Upcoming tasks
      else if (dueDate && dueDate >= tomorrow) {
        categorized.upcoming.push(task);
      }
      // Tasks without due dates go to upcoming
      else if (!dueDate) {
        categorized.upcoming.push(task);
      }
    }

    // Sort each category by priority and due date
    const sortByPriority = (a: any, b: any) => {
      const priorityA = a.priority?.id || 3;
      const priorityB = b.priority?.id || 3;
      return priorityA - priorityB;
    };

    const sortByDueDate = (a: any, b: any) => {
      const dueA = a.due_date ? parseInt(a.due_date) : Infinity;
      const dueB = b.due_date ? parseInt(b.due_date) : Infinity;
      return dueA - dueB;
    };

    categorized.highPriority.sort(sortByPriority);
    categorized.dueToday.sort(sortByPriority);
    categorized.overdue.sort(sortByDueDate);
    categorized.upcoming.sort(sortByDueDate);

    return categorized;
  }

  /**
   * Generate digest summary statistics
   */
  private static generateDigestStats(categorizedTasks: any): {
    totalTasks: number;
    highPriorityCount: number;
    dueTodayCount: number;
    overdueCount: number;
    completionRate: number;
  } {
    const totalTasks = Object.values(categorizedTasks).reduce((sum: number, tasks: any[]) => sum + tasks.length, 0);
    const highPriorityCount = categorizedTasks.highPriority.length;
    const dueTodayCount = categorizedTasks.dueToday.length;
    const overdueCount = categorizedTasks.overdue.length;
    const completedCount = categorizedTasks.completed.length;
    
    const completionRate = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

    return {
      totalTasks,
      highPriorityCount,
      dueTodayCount,
      overdueCount,
      completionRate: Math.round(completionRate)
    };
  }

  /**
   * Validate job data
   */
  static validate(data: any): boolean {
    return data.tenantId && data.userId;
  }

  /**
   * Get job options
   */
  static getJobOptions() {
    return {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000 // Longer delay for digest jobs
      },
      priority: 3, // Lower priority
      removeOnComplete: 50,
      removeOnFail: 25
    };
  }

  /**
   * Schedule daily digest for all users in a tenant
   */
  static async scheduleForTenant(tenantId: string): Promise<void> {
    try {
      const tenant = await Tenant.findOne({ tenantId, status: 'active' });
      if (!tenant || !tenant.settings.features.dailyDigest) {
        return;
      }

      const users = await User.find({ 
        tenantId, 
        status: 'active',
        preferences: { dailyDigest: true }
      });

      // Get current time in tenant's timezone
      const now = new Date();
      const tenantTime = new Date(now.toLocaleString("en-US", {timeZone: tenant.settings.timezone}));
      const currentHour = tenantTime.getHours();
      const digestHour = parseInt(tenant.settings.defaultDigestTime.split(':')[0]);

      // Only schedule if it's the right hour
      if (currentHour !== digestHour) {
        return;
      }

      // Schedule digest for each user
      for (const user of users) {
        if (!user.clickup?.userId) continue;

        await this.scheduleForUser(tenantId, user.clickup.userId);
        
        // Add small delay to avoid overwhelming the queue
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      loggers.tenant('Daily digest scheduled for all users', tenantId, { userCount: users.length });
    } catch (error) {
      loggers.tenant('Failed to schedule daily digest', tenantId, undefined, error as Error);
      throw error;
    }
  }

  /**
   * Schedule daily digest for a specific user
   */
  private static async scheduleForUser(tenantId: string, userId: string): Promise<void> {
    const { QueueService } = require('../queue.service');
    
    await QueueService.addDailyDigest({
      tenantId,
      userId,
      tasks: [], // Will be fetched in the processor
      userPreferences: {} // Will be fetched in the processor
    });
  }
}
