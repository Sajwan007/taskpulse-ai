import Redis from 'ioredis';
import { logger } from '../utils/logger';

let redis: Redis;

/**
 * Connect to Redis instance
 */
export async function connectRedis(): Promise<Redis> {
  try {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not defined');
    }

    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        logger.info(`Redis retry attempt ${times}, delay: ${delay}ms`);
        return delay;
      },
      lazyConnect: true,
      keepAlive: 30000,
      family: 4,
      enableReadyCheck: true,
      maxLoadingTimeout: 5000
    });

    // Event handlers
    redis.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    redis.on('ready', () => {
      logger.info('Redis ready for commands');
    });

    redis.on('error', (err: Error) => {
      logger.error('Redis connection error:', err);
    });

    redis.on('close', () => {
      logger.warn('Redis connection closed');
    });

    redis.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });

    // Test connection
    await redis.connect();
    await redis.ping();

    return redis;

  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
}

/**
 * Get Redis client instance
 */
export function getRedis(): Redis {
  if (!redis) {
    throw new Error('Redis not initialized. Call connectRedis() first.');
  }
  return redis;
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    logger.info('Redis connection closed');
  }
}

/**
 * Redis utility functions for common operations
 */
export class RedisService {
  /**
   * Set a key with optional TTL
   */
  static async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await redis.setex(key, ttlSeconds, serialized);
    } else {
      await redis.set(key, serialized);
    }
  }

  /**
   * Get and deserialize a key
   */
  static async get<T = any>(key: string): Promise<T | null> {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  /**
   * Delete a key
   */
  static async del(key: string): Promise<number> {
    return redis.del(key);
  }

  /**
   * Check if key exists
   */
  static async exists(key: string): Promise<boolean> {
    const result = await redis.exists(key);
    return result === 1;
  }

  /**
   * Increment a counter
   */
  static async incr(key: string): Promise<number> {
    return redis.incr(key);
  }

  /**
   * Increment with expiry (for rate limiting)
   */
  static async incrWithExpiry(key: string, ttlSeconds: number): Promise<number> {
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, ttlSeconds);
    const results = await pipeline.exec();
    return results?.[0]?.[1] as number || 0;
  }

  /**
   * Get all keys matching pattern
   */
  static async keys(pattern: string): Promise<string[]> {
    return redis.keys(pattern);
  }

  /**
   * Set multiple fields in a hash
   */
  static async hset(key: string, fields: Record<string, any>): Promise<number> {
    const serializedFields: Record<string, string> = {};
    for (const [field, value] of Object.entries(fields)) {
      serializedFields[field] = JSON.stringify(value);
    }
    return redis.hset(key, serializedFields);
  }

  /**
   * Get field from hash
   */
  static async hget<T = any>(key: string, field: string): Promise<T | null> {
    const value = await redis.hget(key, field);
    return value ? JSON.parse(value) : null;
  }

  /**
   * Get all fields from hash
   */
  static async hgetall(key: string): Promise<Record<string, any>> {
    const hash = await redis.hgetall(key);
    const result: Record<string, any> = {};
    for (const [field, value] of Object.entries(hash)) {
      result[field] = JSON.parse(value);
    }
    return result;
  }

  /**
   * Add to list
   */
  static async lpush(key: string, ...values: any[]): Promise<number> {
    const serialized = values.map(v => JSON.stringify(v));
    return redis.lpush(key, ...serialized);
  }

  /**
   * Pop from list
   */
  static async rpop<T = any>(key: string): Promise<T | null> {
    const value = await redis.rpop(key);
    return value ? JSON.parse(value) : null;
  }

  /**
   * Get list length
   */
  static async llen(key: string): Promise<number> {
    return redis.llen(key);
  }

  /**
   * Clear all keys (for testing)
   */
  static async flushall(): Promise<string> {
    return redis.flushall();
  }
}
