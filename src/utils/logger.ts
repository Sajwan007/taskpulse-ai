import winston from 'winston';

/**
 * Logger configuration for TaskPulse AI
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'taskpulse-api' },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    
    // File transport for production
    ...(process.env.NODE_ENV === 'production' ? [
      new winston.transports.File({ 
        filename: 'logs/error.log', 
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      }),
      new winston.transports.File({ 
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      })
    ] : [])
  ],
  
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' })
  ]
});

/**
 * Create child logger with additional context
 */
export function createChildLogger(context: Record<string, any>) {
  return logger.child(context);
}

/**
 * Log levels for different types of operations
 */
export const logLevels = {
  HTTP: 'http',
  DATABASE: 'info',
  QUEUE: 'info',
  SLACK: 'info',
  CLICKUP: 'info',
  SIM_AI: 'info',
  ERROR: 'error',
  WARN: 'warn',
  DEBUG: 'debug'
} as const;

/**
 * Helper functions for structured logging
 */
export const loggers = {
  /**
   * Log HTTP requests
   */
  http: (method: string, url: string, statusCode: number, responseTime: number, userId?: string) => {
    logger.http('HTTP Request', {
      method,
      url,
      statusCode,
      responseTime: `${responseTime}ms`,
      userId
    });
  },

  /**
   * Log database operations
   */
  database: (operation: string, collection: string, query?: any, duration?: number) => {
    logger.info('Database Operation', {
      operation,
      collection,
      query: query ? JSON.stringify(query) : undefined,
      duration: duration ? `${duration}ms` : undefined
    });
  },

  /**
   * Log queue operations
   */
  queue: (queueName: string, operation: string, jobId?: string, error?: Error) => {
    if (error) {
      logger.error('Queue Operation Failed', {
        queueName,
        operation,
        jobId,
        error: error.message,
        stack: error.stack
      });
    } else {
      logger.info('Queue Operation', {
        queueName,
        operation,
        jobId
      });
    }
  },

  /**
   * Log Slack operations
   */
  slack: (operation: string, teamId: string, userId?: string, error?: Error) => {
    if (error) {
      logger.error('Slack Operation Failed', {
        operation,
        teamId,
        userId,
        error: error.message,
        stack: error.stack
      });
    } else {
      logger.info('Slack Operation', {
        operation,
        teamId,
        userId
      });
    }
  },

  /**
   * Log ClickUp operations
   */
  clickup: (operation: string, taskId?: string, workspaceId?: string, error?: Error) => {
    if (error) {
      logger.error('ClickUp Operation Failed', {
        operation,
        taskId,
        workspaceId,
        error: error.message,
        stack: error.stack
      });
    } else {
      logger.info('ClickUp Operation', {
        operation,
        taskId,
        workspaceId
      });
    }
  },

  /**
   * Log Sim AI operations
   */
  simAI: (operation: string, workflowId?: string, executionId?: string, error?: Error) => {
    if (error) {
      logger.error('Sim AI Operation Failed', {
        operation,
        workflowId,
        executionId,
        error: error.message,
        stack: error.stack
      });
    } else {
      logger.info('Sim AI Operation', {
        operation,
        workflowId,
        executionId
      });
    }
  },

  /**
   * Log tenant operations
   */
  tenant: (operation: string, tenantId: string, details?: Record<string, any>) => {
    logger.info('Tenant Operation', {
      operation,
      tenantId,
      ...details
    });
  },

  /**
   * Log security events
   */
  security: (event: string, details: Record<string, any>) => {
    logger.warn('Security Event', {
      event,
      ...details,
      timestamp: new Date().toISOString()
    });
  }
};

export default logger;
