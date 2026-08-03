import { isValidObjectId } from "mongoose";
import { Cache } from "./cache";
import { db_connection } from "./db";
import { normalizeProvider, type Provider } from "./options";
import { APPEARANCE_DEFAULTS, ChatbotModel } from "@/models/chatbot.model";

export interface SerializedBot {
  _id: string;
  name: string;
  status: "draft" | "live";
  supportEmail: string;
  businessInfo: { businessName: string; industry: string; description: string };
  botInfo: { botName: string; communicationTone: string; personalityDescription: string };
  appearance: {
    accentColor: string;
    avatarUrl: string;
    displayName: string;
    welcomeMessage: string;
  };
  provider: Provider;
  model: string;
  hasApiKey: boolean;
  apiKeyMasked: string;
  createdAt: string | null;
  updatedAt: string | null;
}

const maskKey = (key: string): string => {
  if (!key) return "";
  if (key.length <= 4) return "••••";
  return `${"•".repeat(Math.min(key.length - 4, 24))}${key.slice(-4)}`;
};

// Shape a lean/hydrated Mongo doc into a plain, client-serializable object (no secrets).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const serializeBot = (bot: any): SerializedBot => {
  const business = (bot.businessInfo ?? {}) as Record<string, string>;
  const persona = (bot.botInfo ?? {}) as Record<string, string>;
  const look = (bot.appearance ?? {}) as Record<string, string>;
  return {
    _id: String(bot._id),
    name: (bot.name as string) ?? "Untitled chatbot",
    status: (bot.status as "draft" | "live") ?? "draft",
    supportEmail: (bot.supportEmail as string) ?? "",
    businessInfo: {
      businessName: business.businessName ?? "",
      industry: business.industry ?? "",
      description: business.description ?? "",
    },
    botInfo: {
      botName: persona.botName ?? "",
      communicationTone: persona.communicationTone ?? "",
      personalityDescription: persona.personalityDescription ?? "",
    },
    appearance: {
      accentColor: look.accentColor ?? APPEARANCE_DEFAULTS.accentColor,
      avatarUrl: look.avatarUrl ?? APPEARANCE_DEFAULTS.avatarUrl,
      displayName: look.displayName ?? APPEARANCE_DEFAULTS.displayName,
      welcomeMessage: look.welcomeMessage ?? APPEARANCE_DEFAULTS.welcomeMessage,
    },
    provider: normalizeProvider(bot.provider as string),
    model: (bot.model as string) ?? "",
    hasApiKey: !!(bot.apiKeyOverride as string),
    apiKeyMasked: maskKey((bot.apiKeyOverride as string) ?? ""),
    createdAt: bot.createdAt ? new Date(bot.createdAt as string).toISOString() : null,
    updatedAt: bot.updatedAt ? new Date(bot.updatedAt as string).toISOString() : null,
  };
};

export const listChatbots = async (ownerId: string): Promise<SerializedBot[]> => {
  return Cache.memoize(`cache:bots:${ownerId}`, 120, async () => {
    await db_connection();
    const bots = await ChatbotModel.find({ ownerId }).sort({ createdAt: 1 }).lean();
    return bots.map(serializeBot);
  });
};

export const getChatbot = async (ownerId: string, botId: string): Promise<SerializedBot | null> => {
  if (!isValidObjectId(botId)) return null;
  return Cache.memoize(`cache:bot:${ownerId}:${botId}`, 120, async () => {
    await db_connection();
    const bot = await ChatbotModel.findOne({ _id: botId, ownerId }).lean();
    return bot ? serializeBot(bot) : null;
  });
};
