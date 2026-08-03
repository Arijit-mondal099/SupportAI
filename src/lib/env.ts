import { z } from "zod";

const envSchema = z.object({
  API_URI: z.string().url(),
  SCALEKIT_ENVIRONMENT_URL: z.string().min(1, "SCALEKIT_ENVIRONMENT_URL is required"),
  SCALEKIT_CLIENT_ID: z.string().min(1, "SCALEKIT_CLIENT_ID is required"),
  SCALEKIT_CLIENT_SECRET: z.string().min(1, "SCALEKIT_CLIENT_SECRET is required"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  PINECONE_API_KEY: z.string().optional(),
  PINECONE_INDEX: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_TOKEN: z.string().optional(),
});

const raw = {
  API_URI: process.env.NEXT_PUBLIC_API_URI,
  SCALEKIT_ENVIRONMENT_URL: process.env.SCALEKIT_ENVIRONMENT_URL,
  SCALEKIT_CLIENT_ID: process.env.SCALEKIT_CLIENT_ID,
  SCALEKIT_CLIENT_SECRET: process.env.SCALEKIT_CLIENT_SECRET,
  MONGODB_URI: process.env.MONGODB_URI,
  PINECONE_API_KEY: process.env.PINECONE_API_KEY,
  PINECONE_INDEX: process.env.PINECONE_INDEX,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_TOKEN: process.env.UPSTASH_REDIS_TOKEN,
};

const parsed = envSchema.safeParse(raw);
if (!parsed.success) {
  console.error("Environment variable validation failed:", parsed.error.issues);
}

export const ENV = parsed.success
  ? parsed.data
  : {
      API_URI: raw.API_URI ?? "",
      SCALEKIT_ENVIRONMENT_URL: raw.SCALEKIT_ENVIRONMENT_URL ?? "",
      SCALEKIT_CLIENT_ID: raw.SCALEKIT_CLIENT_ID ?? "",
      SCALEKIT_CLIENT_SECRET: raw.SCALEKIT_CLIENT_SECRET ?? "",
      MONGODB_URI: raw.MONGODB_URI ?? "",
      PINECONE_API_KEY: raw.PINECONE_API_KEY,
      PINECONE_INDEX: raw.PINECONE_INDEX,
      UPSTASH_REDIS_REST_URL: raw.UPSTASH_REDIS_REST_URL,
      UPSTASH_REDIS_TOKEN: raw.UPSTASH_REDIS_TOKEN,
    };
