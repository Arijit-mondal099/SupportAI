import { vi } from "vitest";

/**
 * Build a mongoose-query-like chainable that is also directly `await`-able.
 *
 * The chat/account routes issue queries in several shapes:
 *   `await Model.findOne(filter)`                       // awaited directly
 *   `await Model.findOne(filter).sort(sort)`            // awaited after .sort()
 *   `await Model.findOne(filter).select(p).lean()`      // awaited after .lean()
 *
 * Returning a single thenable object that also responds to `.sort/.select/.lean`
 * covers all of them with one helper.
 */
export const makeChain = <T>(value: T) =>
  ({
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(value),
    then: (resolve: (v: T) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(value).then(resolve, reject),
    catch: (handler: (e: unknown) => unknown) => Promise.resolve(value).catch(handler),
  }) as unknown as {
    sort: ReturnType<typeof vi.fn>;
    lean: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
  };

export const BOT_ID = "64f0a1b2c3d4e5f6a7b8c9d0";
export const OWNER = { ownerId: "owner_1", email: "owner@example.com" };
