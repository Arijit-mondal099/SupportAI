import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";
import { ENV } from "./env";

let _redis: Redis | null = null;

export const isRateLimitEnabled = (): boolean =>
  !!(ENV.UPSTASH_REDIS_REST_URL && ENV.UPSTASH_REDIS_TOKEN);

const getRedis = (): Redis | null => {
  if (!isRateLimitEnabled()) return null;
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

const INCR_SCRIPT = `
  local current = redis.call("INCR", KEYS[1])
  if current == 1 then
    redis.call("EXPIRE", KEYS[1], ARGV[2])
  end
  local ttl = redis.call("TTL", KEYS[1])
  if current > tonumber(ARGV[1]) then
    return {0, 0, ttl}
  end
  return {1, tonumber(ARGV[1]) - current, ttl}
`;

export interface RateResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
}

export const rateLimit = async (
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateResult> => {
  const redis = getRedis();
  if (!redis) {
    return { allowed: true, remaining: limit - 1, resetIn: windowSeconds };
  }
  try {
    const [allowed, remaining, ttl] = (await redis.eval(
      INCR_SCRIPT,
      [key],
      [String(limit), String(windowSeconds)],
    )) as [number, number, number];
    return {
      allowed: allowed === 1,
      remaining,
      resetIn: Math.max(ttl, 0),
    };
  } catch (err) {
    console.error(`Rate limit check failed for key "${key}"`, err);
    return { allowed: true, remaining: limit - 1, resetIn: windowSeconds };
  }
};

export const getClientIp = (request: NextRequest): string => {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "0.0.0.0";
};
