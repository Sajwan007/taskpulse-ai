import { Job } from 'bullmq';
import { SlackService } from '../slack/slack.service';
import { ClickUpService } from '../clickup/clickup.service';
import { WorkflowService } from '../ai/sim.client';
import { Tenant } from '../../../models/Tenant.model';
import { loggers } from '../../../utils/logger';

/**
 * Process task assignment notifications
 */
export class TaskAssignmentProcessor {
  private static slackService = new SlackService();
  private static clickupService = new ClickUpService();

  /**
   * Process a task assignment job
   */
  static async process(job: Job): Promise<any> {
    const { tenantId, taskId, assigneeId, taskData } = job.data;
    
    try {
      loggers.queue('task-assignment', 'processing', job.id);

      // Get tenant details
      const tenant = await Tenant.findOne({ tenantId, status: 'active' });
      if (!tenant) {
        throw new Error(`Tenant not found: ${tenantId}`);
      }

      // Check if task notifications are enabled
      if (!tenant.settings.features.taskNotifications) {
        loggers.slack('Task notifications disabled for tenant', tenantId);
        return { skipped: true, reason: 'Task notifications disabled' };
      }

      // Get full task data if not provided
      let fullTaskData = taskData;
      if (!fullTaskData || !fullTaskData.name) {
        fullTaskData = await this.clickupService.getTask(tenantId, taskId);
      }

      // Check if we need to use AI for notification formatting
      if (tenant.settings.features.taskNotifications && fullTaskData.description) {
        try {
          // Use Sim AI to format the notification
          const result = await WorkflowService.notifyTaskAssignment({
            tenantId,
            taskId,
            assigneeId,
            taskData: fullTaskData
          });

          // Send the AI-formatted notification
          await this.slackService.sendTaskNotification({
            tenantId,
            userId: assigneeId,
            task: result.formattedTask || fullTaskData,
            priority: fullTaskData.priority?.priority
          });

          loggers.slack('AI-formatted task notification sent', tenantId, assigneeId);
          return { success: true, aiFormatted: true };
        } catch (aiError) {
          loggers.simAI('AI formatting failed, using fallback', undefined, undefined, aiError as Error);
          // Fall back to standard notification
        }
      }

      // Send standard notification
      await this.slackService.sendTaskNotification({
        tenantId,
        userId: assigneeId,
        task: fullTaskData,
        priority: fullTaskData.priority?.priority
      });

      loggers.slack('Standard task notification sent', tenantId, assigneeId);
      return { success: true, aiFormatted: false };

    } catch (error) {
      loggers.queue('task-assignment', 'processing failed', job.id, error as Error);
      throw error;
    }
  }

  /**
   * Validate job data
   */
  static validate(data: any): boolean {
    return data.tenantId && data.taskId && data.assigneeId;
  }

  /**
   * Get job options
   */
  static getJobOptions() {
    return {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      priority: 10,
      removeOnComplete: 100,
      removeOnFail: 50
    };
  }
}
