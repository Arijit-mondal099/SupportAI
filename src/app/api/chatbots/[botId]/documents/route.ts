import { documentCreateSchema } from "@/lib/validations";
import { requireOwner } from "@/lib/auth";
import { db_connection } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import {
  extractTextFromFile,
  extractTextFromNotion,
  UnsupportedFileError,
} from "@/lib/extractFile";
import { supportsEmbeddings } from "@/lib/options";
import { resolveProviderKey } from "@/lib/providerKey";
import { addDocuments, isRagConfigured, splitText } from "@/lib/rag";
import { ChatbotModel } from "@/models/chatbot.model";
import { ChunkModel } from "@/models/chunk.model";
import { DocumentModel } from "@/models/document.model";
import { OwnerModel } from "@/models/owner.model";
import { isValidObjectId } from "mongoose";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ botId: string }>;
}

const unauthorized = () =>
  NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

const notFound = () =>
  NextResponse.json({ success: false, message: "Chatbot not found" }, { status: 404 });

const bad = (message: string) => NextResponse.json({ success: false, message }, { status: 400 });

const stripHtml = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const owner = await requireOwner();
    if (!owner) return unauthorized();

    const { botId } = await params;
    if (!isValidObjectId(botId)) return notFound();

    await db_connection();
    const bot = await ChatbotModel.findOne({ _id: botId, ownerId: owner.ownerId }).select("_id");
    if (!bot) return notFound();

    const documents = await DocumentModel.find({ botId }).sort({ createdAt: -1 }).lean();
    return NextResponse.json({
      success: true,
      documents: documents.map((d) => ({
        _id: String(d._id),
        title: d.title,
        sourceType: d.sourceType,
        status: d.status,
        chunkCount: d.chunkCount,
        notionResourceId: d.notionResourceId,
        notionResourceType: d.notionResourceType,
        createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
      })),
    });
  } catch (error) {
    console.error("GET /documents failed", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const owner = await requireOwner();
    if (!owner) return unauthorized();

    const { botId } = await params;
    if (!isValidObjectId(botId)) return notFound();

    if (!isRagConfigured()) {
      return bad("Knowledge base is not configured on this server (Pinecone).");
    }

    await db_connection();
    const bot = await ChatbotModel.findOne({ _id: botId, ownerId: owner.ownerId });
    if (!bot) return notFound();

    // Rate-limit after confirming the bot belongs to this owner so that
    // unknown/other-owners' bot IDs don't consume anyone's quota.
    const rl = await rateLimit(`rl:docs:${owner.ownerId}:${botId}`, 10, 600);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, message: "Document upload rate limit exceeded. Try again later." },
        { status: 429, headers: { "Retry-After": String(rl.resetIn) } },
      );
    }

    const { provider, apiKey } = resolveProviderKey(bot);
    if (!apiKey) return bad("Add an API key in this bot's Model & key tab first.");
    if (!supportsEmbeddings(provider)) {
      return bad("Only Gemini and OpenAI support the knowledge base.");
    }

    // Resolve the raw text + title + source type from a file upload (multipart)
    // or a JSON body (pasted text / URL).
    let text = "";
    let resolvedTitle = "";
    let sourceType: "file" | "url" | "text" | "notion" = "text";
    let notionResourceId: string | undefined;
    let notionResourceType: "page" | "database" | undefined;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      const title = (form.get("title") as string | null)?.trim() || "";
      if (!(file instanceof File)) return bad("No file provided.");

      sourceType = "file";
      resolvedTitle = title || file.name;
      try {
        text = await extractTextFromFile(file);
      } catch (error) {
        if (error instanceof UnsupportedFileError) {
          return bad("Unsupported file type. Upload a PDF, DOCX, TXT, MD, or CSV file.");
        }
        console.error("File parse failed", error);
        return bad("Could not read that file.");
      }
    } else {
      const parsed = documentCreateSchema.safeParse(await request.json());
      if (!parsed.success) {
        return bad(parsed.error.issues.map((i) => i.message).join("; "));
      }
      const body = parsed.data;
      resolvedTitle = body.title?.trim() || "";

      if (body.sourceType === "url") {
        try {
          text = stripHtml(await fetch(body.url).then((r) => r.text()));
        } catch {
          return bad("Could not fetch the provided URL.");
        }
        sourceType = "url";
        if (!resolvedTitle) resolvedTitle = body.url;
      } else if (body.sourceType === "notion") {
        const ownerDoc = await OwnerModel.findOne({ ownerId: owner.ownerId }).select(
          "+notionIntegrationToken",
        );
        const token = ownerDoc?.notionIntegrationToken as string | undefined;
        if (!token) return bad("Configure a Notion integration token in Plugins first.");
        try {
          text = await extractTextFromNotion(body.resourceId, body.resourceType, token);
        } catch {
          return bad("Could not fetch the Notion resource. Check the ID and integration access.");
        }
        sourceType = "notion";
        notionResourceId = body.resourceId;
        notionResourceType = body.resourceType;
        if (!resolvedTitle) resolvedTitle = `${body.resourceType}: ${body.resourceId}`;
      } else {
        text = body.content;
        sourceType = "text";
        if (!resolvedTitle) resolvedTitle = "Pasted text";
      }
    }

    const chunks = await splitText(text);
    if (!chunks.length) return bad("No usable text found to index.");

    const doc = await DocumentModel.create({
      botId: bot._id,
      ownerId: owner.ownerId,
      title: resolvedTitle,
      sourceType,
      status: "processing",
      notionResourceId,
      notionResourceType,
    });

    try {
      const records = chunks.map((c, i) => ({ id: `${doc._id}_${i}`, text: c }));
      await addDocuments(provider, apiKey, String(bot._id), String(doc._id), records);
      await ChunkModel.insertMany(
        records.map((r) => ({
          botId: bot._id,
          documentId: doc._id,
          pineconeId: r.id,
          text: r.text,
        })),
      );
      doc.status = "ready";
      doc.chunkCount = records.length;
      await doc.save();
    } catch (error) {
      console.error("Document ingestion failed", error);
      doc.status = "error";
      await doc.save();
      return NextResponse.json(
        { success: false, message: "Failed to index the document." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        document: {
          _id: String(doc._id),
          title: doc.title,
          sourceType: doc.sourceType,
          status: doc.status,
          chunkCount: doc.chunkCount,
          notionResourceId: doc.notionResourceId,
          notionResourceType: doc.notionResourceType,
          createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /documents failed", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
