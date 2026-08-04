import { Cache } from "@/lib/cache";
import { db_connection } from "@/lib/db";
import { ChatbotModel } from "@/models/chatbot.model";
import { isValidObjectId } from "mongoose";
import { NextRequest, NextResponse } from "next/server";

const CONFIG_CACHE_TTL = 300;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const cacheHeaders = {
  ...corsHeaders,
  "Cache-Control": `public, s-maxage=${CONFIG_CACHE_TTL}, stale-while-revalidate=${CONFIG_CACHE_TTL * 2}`,
};

export async function GET(request: NextRequest) {
  const botId = request.nextUrl.searchParams.get("botId");

  if (!botId || !isValidObjectId(botId)) {
    return NextResponse.json(
      { success: false, message: "Invalid botId" },
      { status: 400, headers: corsHeaders },
    );
  }

  const cacheKey = `cache:bot_config:${botId}`;
  const cached = await Cache.get<{ appearance: Record<string, unknown> }>(cacheKey);
  if (cached) {
    return NextResponse.json(
      { success: true, appearance: cached.appearance },
      { status: 200, headers: cacheHeaders },
    );
  }

  await db_connection();
  const bot = await ChatbotModel.findOne({ _id: botId, status: "live" })
    .select("appearance")
    .lean();

  if (!bot) {
    const draftBot = await ChatbotModel.findOne({ _id: botId, status: "draft" })
      .select("_id")
      .lean();
    const msg = draftBot ? "This chatbot is not published yet." : "Chatbot not found.";
    return NextResponse.json(
      { success: false, message: msg },
      { status: 404, headers: corsHeaders },
    );
  }

  const response = { success: true, appearance: bot.appearance };
  await Cache.set(cacheKey, { appearance: bot.appearance }, CONFIG_CACHE_TTL);

  return NextResponse.json(response, { status: 200, headers: cacheHeaders });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
