import axios from 'axios';
import { loggers } from '../../utils/logger';

/**
 * Sim AI client for triggering workflows and managing AI operations
 */
export class SimClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = process.env.SIM_API_KEY || '';
    this.baseUrl = process.env.SIM_API_URL || 'https://api.simstudio.ai/v1';
    
    if (!this.apiKey) {
      throw new Error('SIM_API_KEY environment variable is required');
    }
  }

  /**
   * Trigger a Sim workflow
   */
  async triggerWorkflow(workflowId: string, input: Record<string, any>): Promise<{
    executionId: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    output?: any;
  }> {
    try {
      loggers.simAI('Triggering workflow', workflowId);

      const response = await axios.post(
        `${this.baseUrl}/workflows/${workflowId}/execute`,
        { input },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 seconds
        }
      );

      loggers.simAI('Workflow triggered successfully', workflowId, response.data.executionId);
      return response.data;
    } catch (error: any) {
      loggers.simAI('Failed to trigger workflow', workflowId, undefined, error);
      
      if (error.response?.data) {
        throw new Error(`Sim AI API Error: ${error.response.data.message || error.response.data.error}`);
      }
      
      throw error;
    }
  }

  /**
   * Get workflow execution status
   */
  async getExecutionStatus(executionId: string): Promise<{
    executionId: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    output?: any;
    error?: string;
    startedAt?: string;
    completedAt?: string;
  }> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/executions/${executionId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: 10000 // 10 seconds
        }
      );

      return response.data;
    } catch (error: any) {
      loggers.simAI('Failed to get execution status', undefined, executionId, error);
      throw error;
    }
  }

  /**
   * Wait for workflow completion with timeout
   */
  async waitForCompletion(
    executionId: string, 
    timeoutMs: number = 60000, // 1 minute default
    pollIntervalMs: number = 1000 // 1 second polls
  ): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const status = await this.getExecutionStatus(executionId);
        
        if (status.status === 'completed') {
          loggers.simAI('Workflow completed', undefined, executionId);
          return status.output;
        }
        
        if (status.status === 'failed') {
          throw new Error(`Workflow failed: ${status.error || 'Unknown error'}`);
        }
        
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      } catch (error: any) {
        if (error.message.includes('Workflow failed')) {
          throw error;
        }
        
        // Log polling error but continue
        loggers.simAI('Error polling execution status', undefined, executionId, error);
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      }
    }
    
    throw new Error(`Workflow execution timed out after ${timeoutMs}ms`);
  }

  /**
   * List available workflows
   */
  async listWorkflows(): Promise<any[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/workflows`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      return response.data.workflows || [];
    } catch (error: any) {
      loggers.simAI('Failed to list workflows', undefined, undefined, error);
      throw error;
    }
  }

  /**
   * Get workflow details
   */
  async getWorkflow(workflowId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/workflows/${workflowId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      return response.data;
    } catch (error: any) {
      loggers.simAI('Failed to get workflow', workflowId, undefined, error);
      throw error;
    }
  }

  /**
   * Create a new workflow (if API supports it)
   */
  async createWorkflow(workflowDefinition: any): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/workflows`,
        workflowDefinition,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      loggers.simAI('Workflow created', response.data.id);
      return response.data;
    } catch (error: any) {
      loggers.simAI('Failed to create workflow', undefined, undefined, error);
      throw error;
    }
  }

  /**
   * Update a workflow
   */
  async updateWorkflow(workflowId: string, updates: any): Promise<any> {
    try {
      const response = await axios.put(
        `${this.baseUrl}/workflows/${workflowId}`,
        updates,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      loggers.simAI('Workflow updated', workflowId);
      return response.data;
    } catch (error: any) {
      loggers.simAI('Failed to update workflow', workflowId, undefined, error);
      throw error;
    }
  }

  /**
   * Delete a workflow
   */
  async deleteWorkflow(workflowId: string): Promise<void> {
    try {
      await axios.delete(
        `${this.baseUrl}/workflows/${workflowId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      loggers.simAI('Workflow deleted', workflowId);
    } catch (error: any) {
      loggers.simAI('Failed to delete workflow', workflowId, undefined, error);
      throw error;
    }
  }

  /**
   * Get workflow execution history
   */
  async getExecutionHistory(workflowId: string, limit: number = 50): Promise<any[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/workflows/${workflowId}/executions`,
        {
          params: { limit },
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      return response.data.executions || [];
    } catch (error: any) {
      loggers.simAI('Failed to get execution history', workflowId, undefined, error);
      throw error;
    }
  }

  /**
   * Cancel a running execution
   */
  async cancelExecution(executionId: string): Promise<void> {
    try {
      await axios.post(
        `${this.baseUrl}/executions/${executionId}/cancel`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      loggers.simAI('Execution cancelled', undefined, executionId);
    } catch (error: any) {
      loggers.simAI('Failed to cancel execution', undefined, executionId, error);
      throw error;
    }
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.listWorkflows();
      return true;
    } catch (error) {
      loggers.simAI('Connection test failed', undefined, undefined, error as Error);
      return false;
    }
  }
}

// Singleton instance
export const simClient = new SimClient();

// Workflow IDs (these should be configured after deploying workflows)
export const WORKFLOW_IDS = {
  TASK_ASSIGNMENT_NOTIFICATION: process.env.SIM_WORKFLOW_TASK_NOTIFICATION || '',
  DAILY_TASK_DIGEST: process.env.SIM_WORKFLOW_DAILY_DIGEST || '',
  COMMENT_SUMMARIZER: process.env.SIM_WORKFLOW_COMMENT_SUMMARIZER || '',
  FOCUS_MODE: process.env.SIM_WORKFLOW_FOCUS_MODE || '',
  TASK_EXPLAINER: process.env.SIM_WORKFLOW_TASK_EXPLAINER || ''
} as const;

/**
 * Convenience functions for common workflow operations
 */
export class WorkflowService {
  /**
   * Trigger task assignment notification
   */
  static async notifyTaskAssignment(params: {
    tenantId: string;
    taskId: string;
    assigneeId: string;
    taskData: any;
  }): Promise<any> {
    if (!WORKFLOW_IDS.TASK_ASSIGNMENT_NOTIFICATION) {
      throw new Error('Task assignment workflow not configured');
    }

    return simClient.triggerWorkflow(WORKFLOW_IDS.TASK_ASSIGNMENT_NOTIFICATION, {
      tenantId: params.tenantId,
      taskId: params.taskId,
      assigneeId: params.assigneeId,
      taskData: params.taskData,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Trigger daily digest generation
   */
  static async generateDailyDigest(params: {
    tenantId: string;
    userId: string;
    tasks: any[];
    userPreferences: any;
  }): Promise<any> {
    if (!WORKFLOW_IDS.DAILY_TASK_DIGEST) {
      throw new Error('Daily digest workflow not configured');
    }

    return simClient.triggerWorkflow(WORKFLOW_IDS.DAILY_TASK_DIGEST, {
      tenantId: params.tenantId,
      userId: params.userId,
      tasks: params.tasks,
      userPreferences: params.userPreferences,
      timezone: params.userPreferences.timezone || 'UTC',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Trigger comment summarization
   */
  static async summarizeComments(params: {
    tenantId: string;
    taskId: string;
    taskName: string;
    comments: any[];
  }): Promise<any> {
    if (!WORKFLOW_IDS.COMMENT_SUMMARIZER) {
      throw new Error('Comment summarizer workflow not configured');
    }

    return simClient.triggerWorkflow(WORKFLOW_IDS.COMMENT_SUMMARIZER, {
      tenantId: params.tenantId,
      taskId: params.taskId,
      taskName: params.taskName,
      comments: params.comments,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Trigger focus mode analysis
   */
  static async analyzeFocusTasks(params: {
    tenantId: string;
    userId: string;
    tasks: any[];
    userPreferences: any;
  }): Promise<any> {
    if (!WORKFLOW_IDS.FOCUS_MODE) {
      throw new Error('Focus mode workflow not configured');
    }

    return simClient.triggerWorkflow(WORKFLOW_IDS.FOCUS_MODE, {
      tenantId: params.tenantId,
      userId: params.userId,
      tasks: params.tasks,
      userPreferences: params.userPreferences,
      maxTasks: params.userPreferences.focusMode?.maxTasks || 3,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Trigger task explanation
   */
  static async explainTask(params: {
    tenantId: string;
    userId: string;
    taskId: string;
    taskData: any;
  }): Promise<any> {
    if (!WORKFLOW_IDS.TASK_EXPLAINER) {
      throw new Error('Task explainer workflow not configured');
    }

    return simClient.triggerWorkflow(WORKFLOW_IDS.TASK_EXPLAINER, {
      tenantId: params.tenantId,
      userId: params.userId,
      taskId: params.taskId,
      taskData: params.taskData,
      timestamp: new Date().toISOString()
    });
  }
}
