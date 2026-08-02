import { describe, it, expect } from "vitest";
import { serializeBot, type SerializedBot } from "./chatbots";
import { APPEARANCE_DEFAULTS } from "@/models/chatbot.model";

const fullBot = {
  _id: "64f0a1b2c3d4e5f6a7b8c9d0",
  name: "Acme Bot",
  status: "live",
  supportEmail: "support@acme.co",
  provider: "openai",
  model: "gpt-4o",
  apiKeyOverride: "sk-abcdef123456",
  businessInfo: { businessName: "Acme", industry: "SaaS", description: "Billing" },
  botInfo: { botName: "AcmeBot", communicationTone: "Friendly", personalityDescription: "Helpful" },
  appearance: {
    accentColor: "#000000",
    avatarUrl: "https://img/av.png",
    displayName: "Acme",
    welcomeMessage: "Hi there",
  },
  createdAt: new Date("2024-01-02T03:04:05.000Z"),
  updatedAt: new Date("2024-05-06T07:08:09.000Z"),
};

describe("serializeBot", () => {
  it("shapes a full bot into a client-safe object", () => {
    const out: SerializedBot = serializeBot(fullBot);
    expect(out._id).toBe("64f0a1b2c3d4e5f6a7b8c9d0");
    expect(out.name).toBe("Acme Bot");
    expect(out.status).toBe("live");
    expect(out.supportEmail).toBe("support@acme.co");
    expect(out.provider).toBe("openai");
    expect(out.model).toBe("gpt-4o");
    expect(out.hasApiKey).toBe(true);
    expect(out.createdAt).toBe("2024-01-02T03:04:05.000Z");
    expect(out.updatedAt).toBe("2024-05-06T07:08:09.000Z");
  });

  it("does not leak the raw api key and masks per maskKey rules", () => {
    const out = serializeBot(fullBot);
    // len 15 -> (15-4)=11 dots + last 4 chars "3456"
    expect(out.apiKeyMasked).toBe(`${"•".repeat(11)}3456`);
    expect(out.apiKeyMasked).not.toContain("abcdef");
  });

  it("masks the api key consistently with maskKey rules", () => {
    // len <= 4 -> all dots
    expect(serializeBot({ ...fullBot, apiKeyOverride: "ab" }).apiKeyMasked).toBe("••••");
    // empty -> empty string
    expect(serializeBot({ ...fullBot, apiKeyOverride: "" }).apiKeyMasked).toBe("");
  });

  it("reports hasApiKey=false and masked empty when no key set", () => {
    const out = serializeBot({ ...fullBot, apiKeyOverride: "" });
    expect(out.hasApiKey).toBe(false);
    expect(out.apiKeyMasked).toBe("");
  });

  it("normalizes a foreign provider to gemini", () => {
    const out = serializeBot({ ...fullBot, provider: "claude" });
    expect(out.provider).toBe("gemini");
  });

  it("falls back to appearance defaults when appearance missing", () => {
    const out = serializeBot({ ...fullBot, appearance: undefined });
    expect(out.appearance.accentColor).toBe(APPEARANCE_DEFAULTS.accentColor);
    expect(out.appearance.displayName).toBe(APPEARANCE_DEFAULTS.displayName);
    expect(out.appearance.welcomeMessage).toBe(APPEARANCE_DEFAULTS.welcomeMessage);
    expect(out.appearance.avatarUrl).toBe(APPEARANCE_DEFAULTS.avatarUrl);
  });

  it("defaults business/bot info and supportEmail when missing", () => {
    const out = serializeBot({
      ...fullBot,
      businessInfo: undefined,
      botInfo: undefined,
      supportEmail: undefined,
    });
    expect(out.businessInfo.businessName).toBe("");
    expect(out.botInfo.botName).toBe("");
    expect(out.supportEmail).toBe("");
  });

  it("distinguishes absent (defaulted) from empty-string (preserved) fields", () => {
    // nullish coalescing: "" is kept, undefined falls back to the default
    const empty = serializeBot({ ...fullBot, model: "", name: "" });
    expect(empty.model).toBe("");
    expect(empty.name).toBe("");

    const missing = serializeBot({ ...fullBot, model: undefined, name: undefined });
    expect(missing.model).toBe("");
    expect(missing.name).toBe("Untitled chatbot");
  });

  it("returns null timestamps when dates missing", () => {
    const out = serializeBot({ ...fullBot, createdAt: undefined, updatedAt: undefined });
    expect(out.createdAt).toBeNull();
    expect(out.updatedAt).toBeNull();
  });
});
