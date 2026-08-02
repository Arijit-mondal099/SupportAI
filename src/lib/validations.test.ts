import { describe, it, expect } from "vitest";
import {
  chatbotCreateSchema,
  chatbotUpdateSchema,
  chatRequestSchema,
  documentCreateSchema,
} from "./validations";

describe("chatRequestSchema", () => {
  it("accepts a request with botId", () => {
    const res = chatRequestSchema.safeParse({
      prompt: "hello",
      botId: "64f0a1b2c3d4e5f6a7b8c9d0",
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.botId).toBe("64f0a1b2c3d4e5f6a7b8c9d0");
  });

  it("accepts a request with ownerId", () => {
    const res = chatRequestSchema.safeParse({ prompt: "hi", ownerId: "owner_123" });
    expect(res.success).toBe(true);
  });

  it("rejects when neither botId nor ownerId is provided", () => {
    const res = chatRequestSchema.safeParse({ prompt: "hi" });
    expect(res.success).toBe(false);
    expect(res.error!.flatten().formErrors).toContain("Either botId or ownerId is required");
  });

  it("requires a non-empty prompt", () => {
    const res = chatRequestSchema.safeParse({ prompt: "" });
    expect(res.success).toBe(false);
    expect(res.error!.flatten().fieldErrors.prompt?.[0]).toBe("prompt is required");
  });

  it("validates history roles", () => {
    const res = chatRequestSchema.safeParse({
      prompt: "hi",
      botId: "64f0a1b2c3d4e5f6a7b8c9d0",
      history: [{ role: "user", text: "previous" }],
    });
    expect(res.success).toBe(true);

    const bad = chatRequestSchema.safeParse({
      prompt: "hi",
      botId: "64f0a1b2c3d4e5f6a7b8c9d0",
      history: [{ role: "assistant", text: "previous" }],
    });
    expect(bad.success).toBe(false);
  });

  it("treats botId nullish as acceptable when ownerId present", () => {
    const res = chatRequestSchema.safeParse({ prompt: "hi", botId: null, ownerId: "o1" });
    expect(res.success).toBe(true);
  });
});

describe("chatbotCreateSchema", () => {
  it("builds a fully-specified chatbot", () => {
    const res = chatbotCreateSchema.safeParse({
      name: "My Bot",
      status: "live",
      supportEmail: "support@co.com",
      provider: "openai",
      model: "gpt-4o",
      apiKey: "sk-1",
      businessInfo: { businessName: "Co", industry: "SaaS", description: "desc" },
      botInfo: { botName: "CoBot", communicationTone: "Friendly", personalityDescription: "x" },
    });
    expect(res.success).toBe(true);
  });

  it("rejects an invalid support email", () => {
    const res = chatbotCreateSchema.safeParse({ supportEmail: "not-an-email" });
    expect(res.success).toBe(false);
  });

  it("accepts an empty supportEmail (legacy)", () => {
    const res = chatbotCreateSchema.safeParse({ supportEmail: "" });
    expect(res.success).toBe(true);
  });

  it("rejects unknown provider", () => {
    const res = chatbotCreateSchema.safeParse({ provider: "claude" });
    expect(res.success).toBe(false);
  });

  it("rejects unknown status", () => {
    const res = chatbotCreateSchema.safeParse({ status: "archived" });
    expect(res.success).toBe(false);
  });

  it("defaults to an empty object with no input", () => {
    const res = chatbotCreateSchema.safeParse({});
    expect(res.success).toBe(true);
    if (res.success) expect(res.data).toEqual({});
  });
});

describe("chatbotUpdateSchema", () => {
  it("validates appearance block including hex color", () => {
    const good = chatbotUpdateSchema.safeParse({
      appearance: { accentColor: "#e8440a", displayName: "Bot" },
    });
    expect(good.success).toBe(true);

    const badColor = chatbotUpdateSchema.safeParse({
      appearance: { accentColor: "e8440a" },
    });
    expect(badColor.success).toBe(false);

    const badName = chatbotUpdateSchema.safeParse({ appearance: { displayName: "" } });
    expect(badName.success).toBe(false);
  });

  it("enforces name max length", () => {
    const res = chatbotUpdateSchema.safeParse({ name: "a".repeat(101) });
    expect(res.success).toBe(false);
  });
});

describe("documentCreateSchema", () => {
  it("validates url source", () => {
    expect(
      documentCreateSchema.safeParse({ sourceType: "url", url: "https://example.com" }).success,
    ).toBe(true);
    expect(documentCreateSchema.safeParse({ sourceType: "url", url: "example.com" }).success).toBe(
      false,
    );
  });

  it("validates text source requiring content", () => {
    expect(documentCreateSchema.safeParse({ sourceType: "text", content: "x" }).success).toBe(true);
    expect(documentCreateSchema.safeParse({ sourceType: "text", content: "" }).success).toBe(false);
  });

  it("validates notion source with resourceType", () => {
    expect(
      documentCreateSchema.safeParse({
        sourceType: "notion",
        resourceId: "a".repeat(32),
        resourceType: "page",
      }).success,
    ).toBe(true);
    expect(
      documentCreateSchema.safeParse({ sourceType: "notion", resourceId: "x", resourceType: "db" })
        .success,
    ).toBe(false);
  });
});
