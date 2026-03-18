import { WebClient } from '@slack/web-api';
import { Tenant } from '../../models/Tenant.model';
import { User } from '../../models/User.model';
import { loggers } from '../../utils/logger';

/**
 * Slack service for handling Slack API interactions
 */
export class SlackService {
  private clients: Map<string, WebClient> = new Map();

  /**
   * Get or create a Slack client for a tenant
   */
  async getClient(tenantId: string): Promise<WebClient> {
    if (this.clients.has(tenantId)) {
      return this.clients.get(tenantId)!;
    }

    const tenant = await Tenant.findOne({ tenantId, status: 'active' });
    if (!tenant || !tenant.slack?.botToken) {
      throw new Error(`Slack not connected for tenant: ${tenantId}`);
    }

    const client = new WebClient(tenant.slack.botToken);
    this.clients.set(tenantId, client);
    return client;
  }

  /**
   * Send a task assignment notification to a user
   */
  async sendTaskNotification(params: {
    tenantId: string;
    userId: string;
    task: any;
    priority?: string;
  }): Promise<void> {
    try {
      const client = await this.getClient(params.tenantId);
      const tenant = await Tenant.findOne({ tenantId: params.tenantId });
      
      if (!tenant) {
        throw new Error(`Tenant not found: ${params.tenantId}`);
      }

      // Find Slack user ID from mapping
      const userMapping = tenant.findUserMapping('clickup', params.userId);
      if (!userMapping?.slackUserId) {
        loggers.slack('User mapping not found', params.tenantId, params.userId);
        return;
      }

      // Check if user has notifications enabled
      const user = await User.findOne({ 
        tenantId: params.tenantId, 
        'clickup.userId': params.userId 
      });
      
      if (user && !user.preferences.notifications.taskAssigned) {
        loggers.slack('User has disabled task notifications', params.tenantId, userMapping.slackUserId);
        return;
      }

      // Check quiet hours
      if (user?.isInQuietHours()) {
        loggers.slack('User is in quiet hours', params.tenantId, userMapping.slackUserId);
        return;
      }

      // Send the notification
      await client.chat.postMessage({
        channel: userMapping.slackUserId,
        ...this.formatTaskNotification(params.task, params.priority),
        text: `New task assigned: ${params.task.name}`
      });

      loggers.slack('Task notification sent', params.tenantId, userMapping.slackUserId);
    } catch (error) {
      loggers.slack('Failed to send task notification', params.tenantId, params.userId, error as Error);
      throw error;
    }
  }

  /**
   * Send a daily digest to a user
   */
  async sendDailyDigest(params: {
    tenantId: string;
    userId: string;
    digest: any;
  }): Promise<void> {
    try {
      const client = await this.getClient(params.tenantId);
      const tenant = await Tenant.findOne({ tenantId: params.tenantId });
      
      if (!tenant) {
        throw new Error(`Tenant not found: ${params.tenantId}`);
      }

      const userMapping = tenant.findUserMapping('clickup', params.userId);
      if (!userMapping?.slackUserId) {
        loggers.slack('User mapping not found', params.tenantId, params.userId);
        return;
      }

      await client.chat.postMessage({
        channel: userMapping.slackUserId,
        ...this.formatDailyDigest(params.digest),
        text: `Your daily task digest - ${new Date().toLocaleDateString()}`
      });

      loggers.slack('Daily digest sent', params.tenantId, userMapping.slackUserId);
    } catch (error) {
      loggers.slack('Failed to send daily digest', params.tenantId, params.userId, error as Error);
      throw error;
    }
  }

  /**
   * Send focus mode recommendations
   */
  async sendFocusRecommendations(params: {
    tenantId: string;
    userId: string;
    recommendations: any[];
  }): Promise<void> {
    try {
      const client = await this.getClient(params.tenantId);
      const tenant = await Tenant.findOne({ tenantId: params.tenantId });
      
      if (!tenant) {
        throw new Error(`Tenant not found: ${params.tenantId}`);
      }

      const userMapping = tenant.findUserMapping('clickup', params.userId);
      if (!userMapping?.slackUserId) {
        loggers.slack('User mapping not found', params.tenantId, params.userId);
        return;
      }

      await client.chat.postMessage({
        channel: userMapping.slackUserId,
        ...this.formatFocusRecommendations(params.recommendations),
        text: '🎯 Your focus tasks for today'
      });

      loggers.slack('Focus recommendations sent', params.tenantId, userMapping.slackUserId);
    } catch (error) {
      loggers.slack('Failed to send focus recommendations', params.tenantId, params.userId, error as Error);
      throw error;
    }
  }

  /**
   * Send task explanation
   */
  async sendTaskExplanation(params: {
    tenantId: string;
    userId: string;
    taskExplanation: any;
  }): Promise<void> {
    try {
      const client = await this.getClient(params.tenantId);
      const tenant = await Tenant.findOne({ tenantId: params.tenantId });
      
      if (!tenant) {
        throw new Error(`Tenant not found: ${params.tenantId}`);
      }

      const userMapping = tenant.findUserMapping('clickup', params.userId);
      if (!userMapping?.slackUserId) {
        loggers.slack('User mapping not found', params.tenantId, params.userId);
        return;
      }

      await client.chat.postMessage({
        channel: userMapping.slackUserId,
        ...this.formatTaskExplanation(params.taskExplanation),
        text: `📋 Task Explanation: ${params.taskExplanation.taskName}`
      });

      loggers.slack('Task explanation sent', params.tenantId, userMapping.slackUserId);
    } catch (error) {
      loggers.slack('Failed to send task explanation', params.tenantId, params.userId, error as Error);
      throw error;
    }
  }

  /**
   * Format task notification for Slack
   */
  private formatTaskNotification(task: any, priority?: string) {
    const priorityEmoji = {
      urgent: '🔴',
      high: '🟠',
      normal: '🟡',
      low: '🟢'
    };

    return {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '📌 New Task Assigned'
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Task:*\n${task.name}`
            },
            {
              type: 'mrkdwn',
              text: `*Priority:*\n${priorityEmoji[priority as keyof typeof priorityEmoji] || '⚪'} ${priority || 'None'}`
            },
            {
              type: 'mrkdwn',
              text: `*Due Date:*\n${task.due_date ? new Date(parseInt(task.due_date)).toLocaleDateString() : 'Not set'}`
            },
            {
              type: 'mrkdwn',
              text: `*List:*\n${task.list?.name || 'Unknown'}`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: task.description ? task.description.substring(0, 200) + (task.description.length > 200 ? '...' : '') : '_No description_'
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '📋 Open in ClickUp'
              },
              url: task.url,
              action_id: 'open_clickup'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '📖 Explain Task'
              },
              action_id: 'explain_task',
              value: task.id
            }
          ]
        }
      ]
    };
  }

  /**
   * Format daily digest for Slack
   */
  private formatDailyDigest(digest: any) {
    return {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🌅 Good Morning! Here's your task digest`
          }
        },
        ...(digest.highPriority?.length > 0 ? [{
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🔥 *High Priority Tasks*\n${digest.highPriority.map((task: any) => `• ${task.name}`).join('\n')}`
          }
        }] : []),
        ...(digest.dueToday?.length > 0 ? [{
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `⏰ *Due Today*\n${digest.dueToday.map((task: any) => `• ${task.name}`).join('\n')}`
          }
        }] : []),
        ...(digest.overdue?.length > 0 ? [{
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `⚠️ *Overdue*\n${digest.overdue.map((task: any) => `• ${task.name}`).join('\n')}`
          }
        }] : []),
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: digest.motivation || 'Have a productive day! 💪'
          }
        }
      ]
    };
  }

  /**
   * Format focus recommendations for Slack
   */
  private formatFocusRecommendations(recommendations: any[]) {
    return {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🎯 Your Focus Tasks for Today'
          }
        },
        ...recommendations.map((task, index) => ({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${index + 1}. ${task.name}*\n${task.reason}\n_⏱️ Estimated: ${task.estimatedTime || 'N/A'}_`
          }
        })),
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '💡 *Tip:* Start with the first task and avoid multitasking for best results!'
          }
        }
      ]
    };
  }

  /**
   * Format task explanation for Slack
   */
  private formatTaskExplanation(explanation: any) {
    return {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '📋 Task Explanation'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Task:* ${explanation.taskName}\n\n*Goal:*\n${explanation.goal}\n\n*Requirements:*\n${explanation.requirements}`
          }
        },
        ...(explanation.context ? [{
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Context:*\n${explanation.context}`
          }
        }] : []),
        ...(explanation.suggestedApproach ? [{
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Suggested Approach:*\n${explanation.suggestedApproach}`
          }
        }] : []),
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '📋 Open in ClickUp'
              },
              url: explanation.taskUrl
            }
          ]
        }
      ]
    };
  }

  /**
   * Get user info from Slack
   */
  async getUserInfo(tenantId: string, slackUserId: string): Promise<any> {
    try {
      const client = await this.getClient(tenantId);
      const result = await client.users.info({ user: slackUserId });
      return result.user;
    } catch (error) {
      loggers.slack('Failed to get user info', tenantId, slackUserId, error as Error);
      throw error;
    }
  }

  /**
   * Get workspace info
   */
  async getWorkspaceInfo(tenantId: string): Promise<any> {
    try {
      const client = await this.getClient(tenantId);
      const result = await client.team.info();
      return result.team;
    } catch (error) {
      loggers.slack('Failed to get workspace info', tenantId, undefined, error as Error);
      throw error;
    }
  }

  /**
   * Clear client cache for a tenant
   */
  clearClient(tenantId: string): void {
    this.clients.delete(tenantId);
  }

  /**
   * Clear all client caches
   */
  clearAllClients(): void {
    this.clients.clear();
  }
}
