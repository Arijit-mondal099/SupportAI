import { getChatModel } from "@/lib/ai";
import { db_connection } from "@/lib/db";
import { Cache } from "@/lib/cache";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { supportsEmbeddings } from "@/lib/options";
import { resolveProviderKey } from "@/lib/providerKey";
import { isRagConfigured, retrieve } from "@/lib/rag";
import { ChatbotModel } from "@/models/chatbot.model";
import { ConversationModel } from "@/models/conversation.model";
import { MessageModel } from "@/models/message.model";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { isValidObjectId } from "mongoose";
import { chatRequestSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// How many prior messages to replay as context for multi-turn conversations.
const HISTORY_LIMIT = 20;

export async function POST(request: NextRequest) {
  try {
    const parsed = chatRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400, headers: corsHeaders },
      );
    }
    const { prompt, botId, ownerId, sessionId, preview, history } = parsed.data;

    const clientIp = getClientIp(request);
    const rateId = botId && isValidObjectId(botId) ? botId : ownerId || "unknown";
    const rl = await rateLimit(`rl:chat:${rateId}:${clientIp}`, preview ? 60 : 20, 60);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, message: "Rate limit exceeded. Please try again later." },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Retry-After": String(rl.resetIn),
          },
        },
      );
    }

    await db_connection();

    // Resolve the chatbot by its id (preferred) or, for legacy data-owner-id
    // embeds, fall back to that owner's first live (else first) bot.
    let bot =
      botId && isValidObjectId(botId)
        ? await ChatbotModel.findOne({ _id: botId, ...(preview ? {} : { status: "live" }) })
        : null;
    if (!bot && ownerId) {
      bot = await ChatbotModel.findOne({ ownerId, status: "live" }).sort({ createdAt: 1 });
      if (!bot) bot = await ChatbotModel.findOne({ ownerId }).sort({ createdAt: 1 });
    }

    if (!bot) {
      const draftBot =
        botId && isValidObjectId(botId)
          ? await ChatbotModel.findOne({ _id: botId, status: "draft" }).select("_id").lean()
          : null;
      const msg = draftBot ? "This chatbot is not published yet." : "Chatbot not found.";
      return NextResponse.json(
        { success: false, message: msg },
        { status: 404, headers: corsHeaders },
      );
    }

    const { provider, apiKey, model } = resolveProviderKey(bot);
    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: "No API key configured for this chatbot." },
        { status: 400, headers: corsHeaders },
      );
    }

    // Replay prior turns for multi-turn context. Preview (playground) chats send
    // their history in the request and are never persisted; embedded chats load
    // it from the stored conversation.
    const priorMessages = [];
    if (preview) {
      for (const m of (history ?? []).slice(-HISTORY_LIMIT)) {
        priorMessages.push(m.role === "model" ? new AIMessage(m.text) : new HumanMessage(m.text));
      }
    } else if (sessionId?.trim()) {
      const conversation = await ConversationModel.findOne({ botId: bot._id, sessionId });
      if (conversation) {
        const prev = await MessageModel.find({ conversationId: conversation._id })
          .sort({ createdAt: 1 })
          .limit(HISTORY_LIMIT)
          .lean();
        for (const m of prev) {
          priorMessages.push(m.role === "model" ? new AIMessage(m.text) : new HumanMessage(m.text));
        }
      }
    }

    // Ground the answer in the bot's knowledge base (best-effort).
    // Only providers with an embeddings API can run retrieval.
    let systemText = bot.knowledge;
    if (isRagConfigured() && supportsEmbeddings(provider)) {
      try {
        const snippets = await retrieve(provider, apiKey, String(bot._id), prompt, 5);
        if (snippets.length) {
          const block = snippets.map((s, i) => `[${i + 1}] ${s}`).join("\n\n");
          systemText = `Relevant knowledge (use this to answer accurately):\n${block}\n\n---\n\n${bot.knowledge}`;
        }
      } catch (ragErr) {
        console.error("RAG retrieve failed", ragErr);
      }
    }

    const chatModel = getChatModel(provider, apiKey, model);
    const result = await chatModel.invoke([
      new SystemMessage(systemText),
      ...priorMessages,
      new HumanMessage(prompt),
    ]);

    const content = result.content;
    const reply =
      typeof content === "string"
        ? content
        : content
            .map((part) =>
              typeof part === "string" ? part : "text" in part ? String(part.text ?? "") : "",
            )
            .join("");

    // Persist the exchange (best-effort; never fail the reply on a logging error).
    // Preview/playground chats are never stored.
    if (!preview && sessionId?.trim()) {
      try {
        const now = new Date();
        const convo = await ConversationModel.findOneAndUpdate(
          { botId: bot._id, sessionId },
          {
            $setOnInsert: { botId: bot._id, ownerId: bot.ownerId, sessionId, startedAt: now },
            $set: { lastMessageAt: now },
            $inc: { messageCount: 2 },
          },
          { new: true, upsert: true },
        );
        await MessageModel.insertMany([
          { conversationId: convo._id, botId: bot._id, role: "user", text: prompt },
          { conversationId: convo._id, botId: bot._id, role: "model", text: reply },
        ]);
      } catch (logErr) {
        console.error("Failed to log conversation", logErr);
      }
    }

    // Invalidate analytics + conversation caches for this bot (best-effort).
    const botOwnerId = typeof bot.ownerId === "string" ? bot.ownerId : String(bot.ownerId);
    void Cache.delete(`cache:analytics:${botOwnerId}`);
    void Cache.delete(`cache:analytics:${botOwnerId}:${String(bot._id)}`);
    void Cache.delete(`cache:conversations:${String(bot._id)}`);
    void Cache.deletePattern(`cache:conversation:${String(bot._id)}:*`);

    return NextResponse.json(
      { success: true, data: { role: "model", text: reply } },
      { status: 200, headers: corsHeaders },
    );
  } catch (error) {
    console.error("Error From AI Gen", error);

    return NextResponse.json(
      { success: false, message: "An error occurred while processing the request.", error },
      { status: 500, headers: corsHeaders },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
