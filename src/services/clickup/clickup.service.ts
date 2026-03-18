import axios from 'axios';
import { Tenant } from '../../models/Tenant.model';
import { TaskCache } from '../../models/TaskCache.model';
import { loggers } from '../../utils/logger';

/**
 * ClickUp service for handling ClickUp API interactions
 */
export class ClickUpService {
  private static readonly CLICKUP_API = 'https://api.clickup.com/api/v2';

  /**
   * Get access token for a tenant
   */
  private async getAccessToken(tenantId: string): Promise<string> {
    const tenant = await Tenant.findOne({ tenantId, status: 'active' });
    if (!tenant || !tenant.clickup?.accessToken) {
      throw new Error(`ClickUp not connected for tenant: ${tenantId}`);
    }
    return tenant.clickup.accessToken;
  }

  /**
   * Make authenticated request to ClickUp API
   */
  private async makeRequest(tenantId: string, endpoint: string, options: any = {}): Promise<any> {
    try {
      const token = await this.getAccessToken(tenantId);
      const url = `${ClickUpService.CLICKUP_API}${endpoint}`;
      
      const response = await axios({
        url,
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      return response.data;
    } catch (error: any) {
      loggers.clickup('API request failed', undefined, undefined, error);
      
      if (error.response?.status === 401) {
        // Token expired, refresh it
        await this.refreshToken(tenantId);
        // Retry the request
        return this.makeRequest(tenantId, endpoint, options);
      }
      
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  private async refreshToken(tenantId: string): Promise<void> {
    const tenant = await Tenant.findOne({ tenantId, status: 'active' });
    if (!tenant?.clickup?.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await axios.post(`${ClickUpService.CLICKUP_API}/oauth/token`, {
        client_id: process.env.CLICKUP_CLIENT_ID,
        client_secret: process.env.CLICKUP_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: tenant.clickup.refreshToken
      });

      const { access_token, refresh_token } = response.data;
      
      await Tenant.updateOne(
        { tenantId },
        { 
          $set: { 
            'clickup.accessToken': access_token,
            'clickup.refreshToken': refresh_token,
            'clickup.tokenExpiry': new Date(Date.now() + 3600000) // 1 hour
          }
        }
      );

      loggers.clickup('Token refreshed successfully', undefined, tenantId);
    } catch (error) {
      loggers.clickup('Token refresh failed', undefined, tenantId, error as Error);
      throw error;
    }
  }

  /**
   * Get task details
   */
  async getTask(tenantId: string, taskId: string): Promise<any> {
    try {
      // Check cache first
      const cached = await TaskCache.findOne({ clickupTaskId: taskId, tenantId });
      if (cached && !cached.needsResync()) {
        loggers.clickup('Task retrieved from cache', taskId, tenantId);
        return cached;
      }

      // Fetch from ClickUp API
      const taskData = await this.makeRequest(tenantId, `/task/${taskId}`);
      
      // Update cache
      if (cached) {
        await cached.updateFromClickUp(taskData);
      } else {
        await TaskCache.create({
          clickupTaskId: taskId,
          tenantId,
          ...this.mapClickUpTaskToCache(taskData)
        });
      }

      loggers.clickup('Task fetched and cached', taskId, tenantId);
      return taskData;
    } catch (error) {
      loggers.clickup('Failed to get task', taskId, tenantId, error as Error);
      throw error;
    }
  }

  /**
   * Get tasks for a user
   */
  async getUserTasks(tenantId: string, clickupUserId: string, options: {
    status?: string[];
    priority?: number[];
    dueDate?: string;
    limit?: number;
  } = {}): Promise<any[]> {
    try {
      const tenant = await Tenant.findOne({ tenantId, status: 'active' });
      if (!tenant?.clickup?.workspaceId) {
        throw new Error('ClickUp workspace not configured');
      }

      // Build query parameters
      const params = new URLSearchParams();
      if (options.status?.length) {
        params.append('statuses[]', options.status.join(','));
      }
      if (options.priority?.length) {
        params.append('priorities[]', options.priority.join(','));
      }
      if (options.dueDate) {
        params.append('due_date', options.dueDate);
      }
      if (options.limit) {
        params.append('limit', options.limit.toString());
      }
      params.append('assignee', clickupUserId);

      // Fetch tasks from ClickUp
      const response = await this.makeRequest(
        tenantId, 
        `/team/${tenant.clickup.workspaceId}/task?${params.toString()}`
      );

      loggers.clickup('User tasks fetched', undefined, tenantId);
      return response.tasks || [];
    } catch (error) {
      loggers.clickup('Failed to get user tasks', undefined, tenantId, error as Error);
      throw error;
    }
  }

  /**
   * Get task comments
   */
  async getTaskComments(tenantId: string, taskId: string): Promise<any[]> {
    try {
      const response = await this.makeRequest(tenantId, `/task/${taskId}/comment`);
      loggers.clickup('Task comments fetched', taskId, tenantId);
      return response.comments || [];
    } catch (error) {
      loggers.clickup('Failed to get task comments', taskId, tenantId, error as Error);
      throw error;
    }
  }

  /**
   * Get workspace members
   */
  async getWorkspaceMembers(tenantId: string): Promise<any[]> {
    try {
      const tenant = await Tenant.findOne({ tenantId, status: 'active' });
      if (!tenant?.clickup?.workspaceId) {
        throw new Error('ClickUp workspace not configured');
      }

      const response = await this.makeRequest(tenantId, `/team/${tenant.clickup.workspaceId}/member`);
      loggers.clickup('Workspace members fetched', undefined, tenantId);
      return response.members || [];
    } catch (error) {
      loggers.clickup('Failed to get workspace members', undefined, tenantId, error as Error);
      throw error;
    }
  }

  /**
   * Register webhook
   */
  async registerWebhook(tenantId: string, events: string[]): Promise<any> {
    try {
      const tenant = await Tenant.findOne({ tenantId, status: 'active' });
      if (!tenant?.clickup?.workspaceId) {
        throw new Error('ClickUp workspace not configured');
      }

      const webhookData = {
        endpoint: `${process.env.API_URL}/webhooks/clickup`,
        events,
        // Optional: specific space/folder/list filters
      };

      const response = await this.makeRequest(
        tenantId,
        `/team/${tenant.clickup.workspaceId}/webhook`,
        {
          method: 'POST',
          data: webhookData
        }
      );

      // Update tenant with webhook info
      await Tenant.updateOne(
        { tenantId },
        { 
          $set: { 
            'clickup.webhookId': response.id,
            'clickup.webhookSecret': response.secret
          }
        }
      );

      loggers.clickup('Webhook registered', undefined, tenantId);
      return response;
    } catch (error) {
      loggers.clickup('Failed to register webhook', undefined, tenantId, error as Error);
      throw error;
    }
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(tenantId: string, webhookId: string): Promise<void> {
    try {
      await this.makeRequest(tenantId, `/webhook/${webhookId}`, {
        method: 'DELETE'
      });

      await Tenant.updateOne(
        { tenantId },
        { 
          $unset: { 
            'clickup.webhookId': '',
            'clickup.webhookSecret': ''
          }
        }
      );

      loggers.clickup('Webhook deleted', webhookId, tenantId);
    } catch (error) {
      loggers.clickup('Failed to delete webhook', webhookId, tenantId, error as Error);
      throw error;
    }
  }

  /**
   * Update task status
   */
  async updateTaskStatus(tenantId: string, taskId: string, status: string): Promise<any> {
    try {
      const response = await this.makeRequest(
        tenantId,
        `/task/${taskId}`,
        {
          method: 'PUT',
          data: { status }
        }
      );

      // Update cache
      const cached = await TaskCache.findOne({ clickupTaskId: taskId, tenantId });
      if (cached) {
        cached.status = status;
        cached.sync.lastSyncedAt = new Date();
        await cached.save();
      }

      loggers.clickup('Task status updated', taskId, tenantId);
      return response;
    } catch (error) {
      loggers.clickup('Failed to update task status', taskId, tenantId, error as Error);
      throw error;
    }
  }

  /**
   * Add comment to task
   */
  async addTaskComment(tenantId: string, taskId: string, comment: string): Promise<any> {
    try {
      const response = await this.makeRequest(
        tenantId,
        `/task/${taskId}/comment`,
        {
          method: 'POST',
          data: { comment_text: comment }
        }
      );

      // Update cache
      const cached = await TaskCache.findOne({ clickupTaskId: taskId, tenantId });
      if (cached) {
        cached.addComment(response);
      }

      loggers.clickup('Task comment added', taskId, tenantId);
      return response;
    } catch (error) {
      loggers.clickup('Failed to add task comment', taskId, tenantId, error as Error);
      throw error;
    }
  }

  /**
   * Map ClickUp task data to cache format
   */
  private mapClickUpTaskToCache(task: any): any {
    return {
      name: task.name,
      description: task.description,
      status: task.status?.status,
      priority: task.priority,
      dueDate: task.due_date ? new Date(parseInt(task.due_date)) : null,
      startDate: task.start_date ? new Date(parseInt(task.start_date)) : null,
      assignees: task.assignees || [],
      creator: task.creator,
      tags: task.tags || [],
      customFields: task.custom_fields || [],
      url: task.url,
      parent: task.parent,
      list: {
        id: task.list?.id,
        name: task.list?.name,
        spaceId: task.space?.id,
        folderId: task.folder?.id
      }
    };
  }

  /**
   * Sync tasks for a tenant
   */
  async syncTasks(tenantId: string, maxAgeMinutes: number = 5): Promise<void> {
    try {
      const staleTasks = await TaskCache.findStaleTasks(maxAgeMinutes);
      
      for (const task of staleTasks) {
        try {
          await this.getTask(tenantId, task.clickupTaskId);
          // Add delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          loggers.clickup('Failed to sync task', task.clickupTaskId, tenantId, error as Error);
        }
      }

      loggers.clickup(`Synced ${staleTasks.length} tasks`, undefined, tenantId);
    } catch (error) {
      loggers.clickup('Task sync failed', undefined, tenantId, error as Error);
      throw error;
    }
  }

  /**
   * Get workspace lists
   */
  async getWorkspaceLists(tenantId: string): Promise<any[]> {
    try {
      const tenant = await Tenant.findOne({ tenantId, status: 'active' });
      if (!tenant?.clickup?.workspaceId) {
        throw new Error('ClickUp workspace not configured');
      }

      const response = await this.makeRequest(tenantId, `/team/${tenant.clickup.workspaceId}/list`);
      loggers.clickup('Workspace lists fetched', undefined, tenantId);
      return response.lists || [];
    } catch (error) {
      loggers.clickup('Failed to get workspace lists', undefined, tenantId, error as Error);
      throw error;
    }
  }
}
