import { Redis } from "@upstash/redis";
import { ENV } from "./env";

let _redis: Redis | null = null;

export const isCacheEnabled = (): boolean =>
  !!(ENV.UPSTASH_REDIS_REST_URL && ENV.UPSTASH_REDIS_TOKEN);

const getRedis = (): Redis | null => {
  if (!isCacheEnabled()) return null;
  if (!_redis) {
    try {
      _redis = new Redis({
        url: ENV.UPSTASH_REDIS_REST_URL!,
        token: ENV.UPSTASH_REDIS_TOKEN!,
      });
    } catch (err) {
      console.error("Redis client init failed", err);
      return null;
    }
  }
  return _redis;
};

export class Cache {
  static async get<T>(key: string): Promise<T | null> {
    const redis = getRedis();
    if (!redis) return null;
    try {
      return (await redis.get<T>(key)) ?? null;
    } catch (err) {
      console.error(`Cache GET failed for key "${key}"`, err);
      return null;
    }
  }

  static async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const redis = getRedis();
    if (!redis) return;
    try {
      await redis.set(key, value, { ex: ttlSeconds });
    } catch (err) {
      console.error(`Cache SET failed for key "${key}"`, err);
    }
  }

  static async delete(key: string | string[]): Promise<void> {
    const redis = getRedis();
    if (!redis) return;
    try {
      const keys = Array.isArray(key) ? key : [key];
      await redis.del(...keys);
    } catch (err) {
      console.error(`Cache DEL failed for key "${key}"`, err);
    }
  }

  static async deletePattern(pattern: string): Promise<void> {
    const redis = getRedis();
    if (!redis) return;
    try {
      const keys = await redis.keys(pattern);
      if (keys.length) await redis.del(...keys);
    } catch (err) {
      console.error(`Cache pattern-delete failed for "${pattern}"`, err);
    }
  }

  static async memoize<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    const cached = await Cache.get<T>(key);
    if (cached !== null) return cached;
    const fresh = await fn();
    await Cache.set(key, fresh, ttlSeconds);
    return fresh;
  }
}
