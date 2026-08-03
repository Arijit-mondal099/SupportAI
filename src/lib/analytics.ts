import { Types } from "mongoose";
import { Cache } from "./cache";
import { db_connection } from "./db";
import { ChatbotModel } from "@/models/chatbot.model";
import { ConversationModel } from "@/models/conversation.model";
import { MessageModel } from "@/models/message.model";

export interface AccountAnalytics {
  totals: { agents: number; liveAgents: number; conversations: number; messages: number };
  daily: { label: string; messages: number }[];
  topAgents: { _id: string; name: string; status: "draft" | "live"; messages: number }[];
  recent: { _id: string; botName: string; messageCount: number; lastMessageAt: string | null }[];
}

const DAYS = 14;

export const getAccountAnalytics = async (ownerId: string): Promise<AccountAnalytics> => {
  return Cache.memoize(`cache:analytics:${ownerId}`, 600, async () => {
    await db_connection();

    const bots = await ChatbotModel.find({ ownerId }).select("_id name status").lean();
    const ids = bots.map((b) => b._id as Types.ObjectId);
    const metaById = new Map(
      bots.map((b) => [
        String(b._id),
        { name: b.name as string, status: b.status as "draft" | "live" },
      ]),
    );

    // Window start: UTC midnight, (DAYS - 1) days ago.
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    start.setUTCDate(start.getUTCDate() - (DAYS - 1));

    const [conversations, messages, dailyAgg, topAgg, recentDocs] = await Promise.all([
      ConversationModel.countDocuments({ ownerId }),
      ids.length ? MessageModel.countDocuments({ botId: { $in: ids } }) : 0,
      ids.length
        ? MessageModel.aggregate([
            { $match: { botId: { $in: ids }, createdAt: { $gte: start } } },
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } },
                count: { $sum: 1 },
              },
            },
          ])
        : [],
      ids.length
        ? MessageModel.aggregate([
            { $match: { botId: { $in: ids } } },
            { $group: { _id: "$botId", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
          ])
        : [],
      ConversationModel.find({ ownerId }).sort({ lastMessageAt: -1 }).limit(6).lean(),
    ]);

    const dailyMap = new Map<string, number>();
    for (const d of dailyAgg as { _id: string; count: number }[]) dailyMap.set(d._id, d.count);

    const daily: { label: string; messages: number }[] = [];
    for (let i = 0; i < DAYS; i++) {
      const day = new Date(start);
      day.setUTCDate(start.getUTCDate() + i);
      const key = day.toISOString().slice(0, 10);
      daily.push({
        label: `${day.getUTCMonth() + 1}/${day.getUTCDate()}`,
        messages: dailyMap.get(key) ?? 0,
      });
    }

    const topAgents = (topAgg as { _id: Types.ObjectId; count: number }[]).map((t) => {
      const meta = metaById.get(String(t._id));
      return {
        _id: String(t._id),
        name: meta?.name ?? "Untitled",
        status: meta?.status ?? "draft",
        messages: t.count,
      };
    });

    const recent = recentDocs.map((c) => ({
      _id: String(c._id),
      botName: metaById.get(String(c.botId))?.name ?? "Agent",
      messageCount: c.messageCount ?? 0,
      lastMessageAt: c.lastMessageAt ? new Date(c.lastMessageAt).toISOString() : null,
    }));

    return {
      totals: {
        agents: bots.length,
        liveAgents: bots.filter((b) => b.status === "live").length,
        conversations,
        messages,
      },
      daily,
      topAgents,
      recent,
    };
  });
};
