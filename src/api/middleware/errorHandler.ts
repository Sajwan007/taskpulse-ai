import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';

/**
 * Custom error class for application errors
 */
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Handle MongoDB validation errors
 */
function handleValidationError(err: any): AppError {
  const errors = Object.values(err.errors).map((error: any) => error.message);
  const message = `Invalid input data: ${errors.join('. ')}`;
  return new AppError(message, 400);
}

/**
 * Handle MongoDB duplicate key errors
 */
function handleDuplicateKeyError(err: any): AppError {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const message = `Duplicate field value: ${field} = ${value}. Please use another value.`;
  return new AppError(message, 400);
}

/**
 * Handle MongoDB cast errors (invalid ObjectId)
 */
function handleCastError(err: any): AppError {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
}

/**
 * Handle JWT errors
 */
function handleJWTError(): AppError {
  return new AppError('Invalid token. Please log in again.', 401);
}

function handleJWTExpiredError(): AppError {
  return new AppError('Your token has expired. Please log in again.', 401);
}

/**
 * Send error response in development
 */
function sendErrorDev(err: AppError, res: Response) {
  res.status(err.statusCode).json({
    status: 'error',
    error: err,
    message: err.message,
    stack: err.stack
  });
}

/**
 * Send error response in production
 */
function sendErrorProd(err: AppError, res: Response) {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: 'error',
      message: err.message
    });
  } else {
    // Programming or other unknown error: don't leak error details
    logger.error('ERROR 💥', err);
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong!'
    });
  }
}

/**
 * Global error handling middleware
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log error
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    tenantId: (req as any).tenantContext?.tenantId,
    userId: (req as any).user?.id
  });

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    // Handle specific error types
    if (error.name === 'ValidationError') error = handleValidationError(error);
    if (error.code === 11000) error = handleDuplicateKeyError(error);
    if (error.name === 'CastError') error = handleCastError(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
}

/**
 * Handle uncaught exceptions
 */
export function handleUncaughtExceptions() {
  process.on('uncaughtException', (err: Error) => {
    logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...', err);
    process.exit(1);
  });
}

/**
 * Handle unhandled promise rejections
 */
export function handleUnhandledRejections() {
  process.on('unhandledRejection', (err: Error) => {
    logger.error('UNHANDLED REJECTION! 💥 Shutting down...', err);
    process.exit(1);
  });
}
