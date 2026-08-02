import { describe, it, expect, vi, beforeEach } from "vitest";
import { SystemMessage } from "@langchain/core/messages";
import { NextRequest } from "next/server";
import { makeChain, BOT_ID } from "@/tests/helpers";
import { POST, OPTIONS } from "./route";

// ---------------------------------------------------------------------------
// Mocks (hoisted so they are installed before `route` imports its deps)
// ---------------------------------------------------------------------------
const mockDb = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const mockGetChatModel = vi.hoisted(() => vi.fn());
const mockResolve = vi.hoisted(() => vi.fn());
const mockIsRag = vi.hoisted(() => vi.fn().mockReturnValue(false));
const mockRetrieve = vi.hoisted(() => vi.fn());
const mockSupportsEmb = vi.hoisted(() => vi.fn().mockReturnValue(true));

const mockFindOne = vi.hoisted(() => vi.fn());
const mockCreate = vi.hoisted(() => vi.fn());

const mockConvFindOne = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const mockConvUpdate = vi.hoisted(() => vi.fn().mockResolvedValue({ _id: "conv1" }));

const mockMsgFind = vi.hoisted(() => vi.fn());
const mockMsgInsertMany = vi.hoisted(() => vi.fn().mockResolvedValue([]));

vi.mock("@/lib/db", () => ({ db_connection: mockDb }));
vi.mock("@/lib/ai", () => ({ getChatModel: mockGetChatModel }));
vi.mock("@/lib/providerKey", () => ({ resolveProviderKey: mockResolve }));
vi.mock("@/lib/rag", () => ({ isRagConfigured: mockIsRag, retrieve: mockRetrieve }));
vi.mock("@/lib/options", () => ({ supportsEmbeddings: mockSupportsEmb }));
vi.mock("@/models/chatbot.model", () => ({
  ChatbotModel: { findOne: mockFindOne, create: mockCreate },
}));
vi.mock("@/models/conversation.model", () => ({
  ConversationModel: { findOne: mockConvFindOne, findOneAndUpdate: mockConvUpdate },
}));
vi.mock("@/models/message.model", () => ({
  MessageModel: { find: mockMsgFind, insertMany: mockMsgInsertMany },
}));

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------
const botDoc = {
  _id: BOT_ID,
  name: "Acme Bot",
  status: "live",
  supportEmail: "support@acme.co",
  provider: "gemini",
  model: "",
  apiKeyOverride: "sk-abc",
  knowledge: "official system knowledge",
  ownerId: "owner_1",
};

let invokeArgs: unknown[];

const jsonReq = (body: unknown) =>
  new NextRequest("https://example.com/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  invokeArgs = [];

  mockDb.mockReset().mockResolvedValue({});
  mockGetChatModel.mockReset().mockReturnValue({
    invoke: (msgs: unknown[]) => {
      invokeArgs.push(msgs);
      return Promise.resolve({ content: "reply text" });
    },
  });
  mockResolve
    .mockReset()
    .mockReturnValue({ provider: "gemini", apiKey: "sk-abc", model: "gemini-1.5-pro" });
  mockIsRag.mockReset().mockReturnValue(false);
  mockRetrieve.mockReset();
  mockSupportsEmb.mockReset().mockReturnValue(true);

  mockFindOne.mockReset();
  mockCreate.mockReset();
  mockConvFindOne.mockReset().mockResolvedValue(null);
  mockConvUpdate.mockReset().mockResolvedValue({ _id: "conv1" });
  mockMsgFind.mockReset();
  mockMsgInsertMany.mockReset().mockResolvedValue([]);
});

describe("OPTIONS", () => {
  it("returns 204 with CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
  });
});

describe("POST /api/chat", () => {
  it("returns 400 on schema failure and skips all downstream work", async () => {
    const res = await POST(jsonReq({ prompt: "" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toContain("prompt is required");
    expect(body.message).toContain("Either botId or ownerId is required");
    expect(mockDb).not.toHaveBeenCalled();
    expect(mockFindOne).not.toHaveBeenCalled();
  });

  it("returns 404 'Chatbot not found.' when no bot matches", async () => {
    mockFindOne.mockImplementation(() => makeChain(null));
    const res = await POST(jsonReq({ prompt: "hi", botId: BOT_ID }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.message).toBe("Chatbot not found.");
  });

  it("returns 404 'not published yet.' when the only match is a draft", async () => {
    mockFindOne.mockImplementation((filter?: Record<string, unknown>) => {
      const value = filter?.status === "draft" ? { _id: BOT_ID, name: "Draft" } : null;
      return makeChain(value);
    });

    const res = await POST(jsonReq({ prompt: "hi", botId: BOT_ID }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.message).toBe("This chatbot is not published yet.");
  });

  it("returns 400 'No API key configured' when resolveProviderKey has no key", async () => {
    mockFindOne.mockImplementation(() => makeChain(botDoc));
    mockResolve.mockReturnValue({ provider: "gemini", apiKey: "", model: "gemini-1.5-pro" });

    const res = await POST(jsonReq({ prompt: "hi", botId: BOT_ID }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.message).toBe("No API key configured for this chatbot.");
    expect(mockGetChatModel).not.toHaveBeenCalled();
  });

  it("returns 200 with the model reply and persists the exchange when not preview", async () => {
    mockFindOne.mockImplementation(() => makeChain(botDoc));

    const res = await POST(jsonReq({ prompt: "hi", botId: BOT_ID, sessionId: "sess_1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ role: "model", text: "reply text" });

    // persistence: upsert conversation + store both messages
    expect(mockConvUpdate).toHaveBeenCalledTimes(1);
    expect(mockMsgInsertMany).toHaveBeenCalledTimes(1);
    const args = mockMsgInsertMany.mock.calls[0][0] as Array<{ role: string; text: string }>;
    expect(args).toHaveLength(2);
    expect(args.map((m) => m.role).sort()).toEqual(["model", "user"]);
    const userMsg = args.find((m) => m.role === "user")!;
    expect(userMsg.text).toBe("hi");
    const modelMsg = args.find((m) => m.role === "model")!;
    expect(modelMsg.text).toBe("reply text");

    // a SystemMessage(system) + HumanMessage(prompt) were sent to the model
    expect(invokeArgs[0]).toHaveLength(2);
  });

  it("replays stored conversation history when not in preview", async () => {
    mockFindOne.mockImplementation(() => makeChain(botDoc));
    // a prior conversation exists -> load its stored messages
    mockConvFindOne.mockResolvedValue({ _id: "conv1" });
    mockMsgFind.mockReturnValue(
      makeChain([
        { role: "user", text: "old question?" },
        { role: "model", text: "old answer." },
      ]),
    );

    const res = await POST(jsonReq({ prompt: "follow up", botId: BOT_ID, sessionId: "sess_2" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.text).toBe("reply text");
    // system + 2 history turns + current human
    expect(invokeArgs[0]).toHaveLength(4);
    // non-preview still persists the new exchange
    expect(mockConvUpdate).toHaveBeenCalledTimes(1);
    expect(mockMsgInsertMany).toHaveBeenCalledTimes(1);
  });

  it("skips persistence in preview mode (uses request history only)", async () => {
    mockFindOne.mockImplementation(() => makeChain(botDoc));

    const res = await POST(
      jsonReq({
        prompt: "new question",
        botId: BOT_ID,
        sessionId: "sess_1",
        preview: true,
        history: [
          { role: "user", text: "previous question" },
          { role: "model", text: "previous answer" },
        ],
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.text).toBe("reply text");
    expect(mockConvUpdate).not.toHaveBeenCalled();
    expect(mockMsgInsertMany).not.toHaveBeenCalled();
    // preview replays history: system + 2 history + current human
    expect(invokeArgs[0]).toHaveLength(4);
  });

  it("injects RAG snippets into the system prompt when configured", async () => {
    mockFindOne.mockImplementation(() => makeChain(botDoc));
    mockIsRag.mockReturnValue(true);
    mockSupportsEmb.mockReturnValue(true);
    mockRetrieve.mockResolvedValue(["snippet one", "snippet two"]);

    const res = await POST(jsonReq({ prompt: "tell me about pricing", botId: BOT_ID }));

    expect(res.status).toBe(200);
    expect(mockRetrieve).toHaveBeenCalledWith(
      "gemini",
      "sk-abc",
      BOT_ID,
      "tell me about pricing",
      5,
    );

    const msgs: unknown[] = invokeArgs[0] as unknown[];
    const sys = msgs.find((m) => m instanceof SystemMessage) as { content: string };
    expect(sys.content).toContain("Relevant knowledge");
    expect(sys.content).toContain("[1] snippet one");
    expect(sys.content).toContain("[2] snippet two");
    expect(sys.content).toContain("official system knowledge");
  });

  it("survives a RAG retrieve failure and still replies (best-effort)", async () => {
    mockFindOne.mockImplementation(() => makeChain(botDoc));
    mockIsRag.mockReturnValue(true);
    mockSupportsEmb.mockReturnValue(true);
    mockRetrieve.mockRejectedValue(new Error("pinecone down"));

    const res = await POST(jsonReq({ prompt: "hi", botId: BOT_ID }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.text).toBe("reply text");
    // system prompt falls back to plain bot knowledge
    const sys = (invokeArgs[0] as unknown[]).find((m) => m instanceof SystemMessage) as {
      content: string;
    };
    expect(sys.content).toBe("official system knowledge");
  });

  it("skips retrieval when the provider cannot embed", async () => {
    mockFindOne.mockImplementation(() => makeChain(botDoc));
    mockIsRag.mockReturnValue(true);
    mockSupportsEmb.mockReturnValue(false);

    const res = await POST(jsonReq({ prompt: "hi", botId: BOT_ID }));
    expect(res.status).toBe(200);
    expect(mockRetrieve).not.toHaveBeenCalled();
  });

  it("returns 500 on unexpected errors", async () => {
    mockDb.mockRejectedValue(new Error("mongo down"));

    const res = await POST(jsonReq({ prompt: "hi", botId: BOT_ID }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.message).toBe("An error occurred while processing the request.");
  });
});
