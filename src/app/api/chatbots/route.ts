import { chatbotCreateSchema } from "@/lib/validations";
import { normalizeProvider } from "@/lib/options";
import { requireOwner } from "@/lib/auth";
import { db_connection } from "@/lib/db";
import { listChatbots, serializeBot } from "@/lib/chatbots";
import { buildKnowledge } from "@/lib/knowledge";
import { ChatbotModel } from "@/models/chatbot.model";
import { Cache } from "@/lib/cache";
import { NextRequest, NextResponse } from "next/server";

const unauthorized = () =>
  NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

// List every chatbot owned by the current account.
export async function GET() {
  const owner = await requireOwner();
  if (!owner) return unauthorized();

  const bots = await listChatbots(owner.ownerId);
  return NextResponse.json({ success: true, bots });
}

// Create a chatbot. Accepts an optional initial config (used by the creation
// wizard); with no body it falls back to a sensible default draft.
export async function POST(request: NextRequest) {
  const owner = await requireOwner();
  if (!owner) return unauthorized();

  const parsed = chatbotCreateSchema.safeParse(await request.json().catch(() => ({})));
  const body = parsed.success ? parsed.data : {};

  const businessInfo = {
    businessName: body.businessInfo?.businessName ?? "",
    industry: body.businessInfo?.industry ?? "",
    description: body.businessInfo?.description ?? "",
  };
  const botInfo = {
    botName: body.botInfo?.botName ?? "",
    communicationTone: body.botInfo?.communicationTone ?? "",
    personalityDescription: body.botInfo?.personalityDescription ?? "",
  };
  const supportEmail = body.supportEmail ?? owner.email ?? "";

  await db_connection();
  const bot = await ChatbotModel.create({
    ownerId: owner.ownerId,
    name: body.name?.trim() || "Untitled chatbot",
    status: body.status === "live" ? "live" : "draft",
    supportEmail,
    provider: normalizeProvider(body.provider),
    model: body.model ?? "",
    apiKeyOverride: body.apiKey?.trim() ?? "",
    businessInfo,
    botInfo,
    knowledge: buildKnowledge({ businessInfo, botInfo, supportEmail }),
  });

  await Cache.delete(`cache:bots:${owner.ownerId}`);
  await Cache.delete(`cache:analytics:${owner.ownerId}`);
  return NextResponse.json({ success: true, bot: serializeBot(bot.toObject()) }, { status: 201 });
}
