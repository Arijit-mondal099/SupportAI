import { chatbotUpdateSchema } from "@/lib/validations";
import { normalizeProvider } from "@/lib/options";
import { requireOwner } from "@/lib/auth";
import { Cache } from "@/lib/cache";
import { db_connection } from "@/lib/db";
import { getChatbot, serializeBot } from "@/lib/chatbots";
import { buildKnowledge } from "@/lib/knowledge";
import { deleteVectors } from "@/lib/rag";
import { ChatbotModel } from "@/models/chatbot.model";
import mongoose, { isValidObjectId } from "mongoose";
import { NextRequest, NextResponse } from "next/server";

interface Params {
  params: Promise<{ botId: string }>;
}

const unauthorized = () =>
  NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

const notFound = () =>
  NextResponse.json({ success: false, message: "Chatbot not found" }, { status: 404 });

export async function GET(_request: NextRequest, { params }: Params) {
  const owner = await requireOwner();
  if (!owner) return unauthorized();

  const { botId } = await params;
  const bot = await getChatbot(owner.ownerId, botId);
  if (!bot) return notFound();

  return NextResponse.json({ success: true, bot });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const owner = await requireOwner();
  if (!owner) return unauthorized();

  const { botId } = await params;
  if (!isValidObjectId(botId)) return notFound();

  const parsed = chatbotUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const body = parsed.data;

  await db_connection();
  const bot = await ChatbotModel.findOne({ _id: botId, ownerId: owner.ownerId });
  if (!bot) return notFound();

  if (body.name) bot.name = body.name.trim() || "Untitled chatbot";
  if (body.status) bot.status = body.status;
  if (body.supportEmail !== undefined) bot.supportEmail = body.supportEmail;
  if (body.provider) bot.provider = normalizeProvider(body.provider);
  if (body.model) bot.model = body.model;
  if (body.apiKey) bot.apiKeyOverride = body.apiKey.trim();

  if (body.businessInfo) {
    bot.businessInfo.businessName = body.businessInfo.businessName ?? bot.businessInfo.businessName;
    bot.businessInfo.industry = body.businessInfo.industry ?? bot.businessInfo.industry;
    bot.businessInfo.description = body.businessInfo.description ?? bot.businessInfo.description;
  }
  if (body.botInfo) {
    bot.botInfo.botName = body.botInfo.botName ?? bot.botInfo.botName;
    bot.botInfo.communicationTone = body.botInfo.communicationTone ?? bot.botInfo.communicationTone;
    bot.botInfo.personalityDescription =
      body.botInfo.personalityDescription ?? bot.botInfo.personalityDescription;
  }

  if (body.appearance) {
    bot.appearance.accentColor = body.appearance.accentColor ?? bot.appearance.accentColor;
    bot.appearance.avatarUrl = body.appearance.avatarUrl ?? bot.appearance.avatarUrl;
    bot.appearance.displayName = body.appearance.displayName ?? bot.appearance.displayName;
    bot.appearance.welcomeMessage = body.appearance.welcomeMessage ?? bot.appearance.welcomeMessage;
  }

  // Regenerate the system instruction from the latest config.
  bot.knowledge = buildKnowledge({
    businessInfo: {
      businessName: bot.businessInfo.businessName,
      industry: bot.businessInfo.industry,
      description: bot.businessInfo.description,
    },
    botInfo: {
      botName: bot.botInfo.botName,
      communicationTone: bot.botInfo.communicationTone,
      personalityDescription: bot.botInfo.personalityDescription,
    },
    supportEmail: bot.supportEmail,
  });

  await bot.save();
  await Cache.delete(`cache:bot_config:${botId}`);
  await Cache.delete(`cache:bot:${owner.ownerId}:${botId}`);
  await Cache.delete(`cache:bots:${owner.ownerId}`);
  await Cache.delete(`cache:analytics:${owner.ownerId}`);
  await Cache.delete(`cache:analytics:${owner.ownerId}:${botId}`);
  await Cache.delete(`cache:conversations:${botId}`);
  await Cache.deletePattern(`cache:conversation:${botId}:*`);
  return NextResponse.json({ success: true, bot: serializeBot(bot.toObject()) });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const owner = await requireOwner();
  if (!owner) return unauthorized();

  const { botId } = await params;
  if (!isValidObjectId(botId)) return notFound();

  const conn = await db_connection();
  const bot = await ChatbotModel.findOne({ _id: botId, ownerId: owner.ownerId });
  if (!bot) return notFound();

  const _id = new mongoose.Types.ObjectId(botId);
  await ChatbotModel.deleteOne({ _id: botId, ownerId: owner.ownerId });

  await Cache.delete(`cache:bot_config:${botId}`);
  await Cache.delete(`cache:bot:${owner.ownerId}:${botId}`);
  await Cache.delete(`cache:analytics:${owner.ownerId}`);
  await Cache.delete(`cache:analytics:${owner.ownerId}:${botId}`);
  await Cache.delete(`cache:bots:${owner.ownerId}`);
  await Cache.delete(`cache:conversations:${botId}`);
  await Cache.deletePattern(`cache:conversation:${botId}:*`);

  // Remove this bot's vectors from Pinecone (best-effort) before dropping the mirrors.
  try {
    const chunkDocs = await conn
      .collection("chunks")
      .find({ botId: _id }, { projection: { pineconeId: 1 } })
      .toArray();
    await deleteVectors(chunkDocs.map((c) => c.pineconeId).filter(Boolean));
  } catch (error) {
    console.error("Pinecone cleanup failed", error);
  }

  // Cascade: remove everything in Mongo that belongs to this bot.
  await Promise.all([
    conn.collection("conversations").deleteMany({ botId: _id }),
    conn.collection("messages").deleteMany({ botId: _id }),
    conn.collection("documents").deleteMany({ botId: _id }),
    conn.collection("chunks").deleteMany({ botId: _id }),
  ]);

  return NextResponse.json({ success: true, message: "Chatbot deleted" });
}
