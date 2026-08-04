import { requireOwner } from "@/lib/auth";
import { Cache } from "@/lib/cache";
import { db_connection } from "@/lib/db";
import { ChatbotModel } from "@/models/chatbot.model";
import { ConversationModel } from "@/models/conversation.model";
import { MessageModel } from "@/models/message.model";
import { isValidObjectId } from "mongoose";
import { NextRequest, NextResponse } from "next/server";

interface Params {
  params: Promise<{ botId: string }>;
}

const unauthorized = () =>
  NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

const notFound = () => NextResponse.json({ success: false, message: "Not found" }, { status: 404 });

export async function GET(request: NextRequest, { params }: Params) {
  const owner = await requireOwner();
  if (!owner) return unauthorized();

  const { botId } = await params;
  if (!isValidObjectId(botId)) return notFound();

  await db_connection();
  const bot = await ChatbotModel.findOne({ _id: botId, ownerId: owner.ownerId }).select("_id");
  if (!bot) return notFound();

  const conversationId = request.nextUrl.searchParams.get("conversationId");

  // Transcript for a single conversation (scoped to this bot).
  if (conversationId) {
    if (!isValidObjectId(conversationId)) return notFound();
    const cacheKey = `cache:conversation:${botId}:${conversationId}`;
    const cached = await Cache.get<
      | {
          _id: string;
          role: "user" | "model";
          text: string;
          createdAt: string | null;
        }[]
      | null
    >(cacheKey);
    if (cached) return NextResponse.json({ success: true, messages: cached });

    const convo = await ConversationModel.findOne({ _id: conversationId, botId });
    if (!convo) return notFound();

    const messages = await MessageModel.find({ conversationId }).sort({ createdAt: 1 }).lean();
    const result = messages.map((m) => ({
      _id: String(m._id),
      role: m.role,
      text: m.text,
      createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : null,
    }));
    await Cache.set(cacheKey, result, 120);
    return NextResponse.json({ success: true, messages: result });
  }

  // List of recent conversations — cached per bot.
  const listKey = `cache:conversations:${botId}`;
  const cachedList = await Cache.get<
    | {
        _id: string;
        sessionId: string;
        messageCount: number;
        startedAt: string | null;
        lastMessageAt: string | null;
      }[]
    | null
  >(listKey);
  if (cachedList) {
    return NextResponse.json({ success: true, conversations: cachedList });
  }

  const conversations = await ConversationModel.find({ botId })
    .sort({ lastMessageAt: -1 })
    .limit(50)
    .lean();

  const result = conversations.map((c) => ({
    _id: String(c._id),
    sessionId: c.sessionId,
    messageCount: c.messageCount,
    startedAt: c.startedAt ? new Date(c.startedAt).toISOString() : null,
    lastMessageAt: c.lastMessageAt ? new Date(c.lastMessageAt).toISOString() : null,
  }));
  await Cache.set(listKey, result, 60);

  return NextResponse.json({ success: true, conversations: result });
}
