import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { OWNER } from "@/tests/helpers";

const mockRequireOwner = vi.hoisted(() => vi.fn());
const mockList = vi.hoisted(() => vi.fn());
const mockSerialize = vi.hoisted(() => vi.fn());
const mockKnowledge = vi.hoisted(() => vi.fn());
const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireOwner: mockRequireOwner }));
vi.mock("@/lib/db", () => ({ db_connection: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/chatbots", () => ({ listChatbots: mockList, serializeBot: mockSerialize }));
vi.mock("@/lib/knowledge", () => ({ buildKnowledge: mockKnowledge }));
vi.mock("@/models/chatbot.model", () => ({
  ChatbotModel: { create: mockCreate },
  APPEARANCE_DEFAULTS: {
    accentColor: "#e8440a",
    avatarUrl: "",
    displayName: "Support Agent",
    welcomeMessage: "Hello! How can I assist you today?",
  },
}));

const jsonReq = (body: unknown) =>
  new NextRequest("https://example.com/api/chatbots", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireOwner.mockReset();
  mockList.mockReset();
  mockSerialize.mockReset();
  mockKnowledge.mockReset().mockReturnValue("stub-knowledge");
  mockCreate.mockReset();
});

describe("GET /api/chatbots", () => {
  it("returns 401 when not authenticated", async () => {
    mockRequireOwner.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mockList).not.toHaveBeenCalled();
  });

  it("returns the owner's chatbots", async () => {
    mockRequireOwner.mockResolvedValue(OWNER);
    const bots = [
      { _id: "b1", name: "Bot 1" },
      { _id: "b2", name: "Bot 2" },
    ];
    mockList.mockResolvedValue(bots);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.bots).toEqual(bots);
    expect(mockList).toHaveBeenCalledWith("owner_1");
  });
});

describe("POST /api/chatbots", () => {
  it("returns 401 when not authenticated", async () => {
    mockRequireOwner.mockResolvedValue(null);
    const res = await POST(jsonReq({}));
    expect(res.status).toBe(401);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("creates a fully-specified bot with the provided config", async () => {
    mockRequireOwner.mockResolvedValue(OWNER);
    const createdDoc = { toObject: () => ({ _id: "b1", name: "My Bot" }) };
    mockCreate.mockResolvedValue(createdDoc);
    mockSerialize.mockReturnValue({ id: "b1", name: "My Bot" });

    const res = await POST(
      jsonReq({
        name: "My Bot",
        status: "live",
        supportEmail: "support@co.com",
        provider: "openai",
        model: "gpt-4o",
        apiKey: "sk-1",
        businessInfo: { businessName: "Co", industry: "SaaS", description: "Billing" },
        botInfo: {
          botName: "CoBot",
          communicationTone: "Friendly",
          personalityDescription: "Helpful",
        },
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.bot).toEqual({ id: "b1", name: "My Bot" });

    const created = mockCreate.mock.calls[0][0];
    expect(created.ownerId).toBe("owner_1");
    expect(created.name).toBe("My Bot");
    expect(created.status).toBe("live");
    expect(created.supportEmail).toBe("support@co.com");
    expect(created.provider).toBe("openai");
    expect(created.model).toBe("gpt-4o");
    expect(created.apiKeyOverride).toBe("sk-1");
    expect(created.businessInfo).toEqual({
      businessName: "Co",
      industry: "SaaS",
      description: "Billing",
    });
    expect(created.botInfo).toEqual({
      botName: "CoBot",
      communicationTone: "Friendly",
      personalityDescription: "Helpful",
    });
    expect(created.knowledge).toBe("stub-knowledge");
    expect(mockKnowledge).toHaveBeenCalledWith({
      businessInfo: created.businessInfo,
      botInfo: created.botInfo,
      supportEmail: "support@co.com",
    });
  });

  it("falls back to defaults for an empty body", async () => {
    mockRequireOwner.mockResolvedValue(OWNER);
    mockCreate.mockResolvedValue({ toObject: () => ({}) });
    mockSerialize.mockReturnValue({ id: "b2" });

    const res = await POST(jsonReq({}));

    expect(res.status).toBe(201);
    const created = mockCreate.mock.calls[0][0];
    expect(created.name).toBe("Untitled chatbot");
    expect(created.status).toBe("draft");
    expect(created.supportEmail).toBe("owner@example.com");
    expect(created.provider).toBe("gemini"); // normalizeProvider(undefined) -> gemini
    expect(created.model).toBe("");
    expect(created.apiKeyOverride).toBe("");
    expect(created.businessInfo).toEqual({ businessName: "", industry: "", description: "" });
    expect(created.botInfo).toEqual({
      botName: "",
      communicationTone: "",
      personalityDescription: "",
    });
  });

  it("ignores invalid fields and falls back to defaults (body resets to {})", async () => {
    mockRequireOwner.mockResolvedValue(OWNER);
    mockCreate.mockResolvedValue({ toObject: () => ({}) });
    mockSerialize.mockReturnValue({ id: "b3" });

    // invalid email invalidates the whole parsed body -> route uses {}
    const res = await POST(jsonReq({ name: "My Bot", supportEmail: "not-an-email" }));
    expect(res.status).toBe(201);

    const created = mockCreate.mock.calls[0][0];
    expect(created.name).toBe("Untitled chatbot");
    expect(created.supportEmail).toBe("owner@example.com");
  });

  it("trims the provided name and api key", async () => {
    mockRequireOwner.mockResolvedValue(OWNER);
    mockCreate.mockResolvedValue({ toObject: () => ({}) });
    mockSerialize.mockReturnValue({ id: "b4" });

    await POST(jsonReq({ name: "  Spaced Bot  ", apiKey: "  sk-trim  " }));
    const created = mockCreate.mock.calls[0][0];
    expect(created.name).toBe("Spaced Bot");
    expect(created.apiKeyOverride).toBe("sk-trim");
  });
});
