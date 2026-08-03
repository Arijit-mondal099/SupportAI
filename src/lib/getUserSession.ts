import { Cache } from "@/lib/cache";
import { getScalekit } from "@/lib/scalekit";
import { cookies } from "next/headers";
import type { Scalekit } from "@scalekit-sdk/node";

type SessionUser = Awaited<ReturnType<Scalekit["user"]["getUser"]>>;

const SESSION_TTL = 300;

export const getUserSession = async (): Promise<SessionUser | null> => {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("access_token")?.value;

    if (!token) return null;

    const cacheKey = `session:${token}`;
    const cached = await Cache.get<SessionUser>(cacheKey);
    if (cached) return cached;

    const scalekit = getScalekit();
    const res = (await scalekit.validateToken(token)) as unknown as { sub: string };
    const user = await scalekit.user.getUser(res.sub);

    await Cache.set(cacheKey, user, SESSION_TTL);

    return user;
  } catch (error) {
    console.log(error);
    return null;
  }
};
