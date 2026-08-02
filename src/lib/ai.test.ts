import { describe, it, expect, vi } from "vitest";

// Isolate AI wiring from real credentials/network. Model/embedding *construction*
// is side-effect free; we only assert provider routing and error contracts.
vi.mock("@/lib/options", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/options")>();
  return { ...actual, defaultModel: actual.defaultModel };
});

import { EMBED_DIMENSIONS, getChatModel, getEmbeddings } from "./ai";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

describe("AI provider wiring", () => {
  it("pins embeddings to one dimension", () => {
    expect(EMBED_DIMENSIONS).toBe(768);
  });

  it("routes openai to ChatOpenAI (model + key applied)", () => {
    const model = getChatModel("openai", "sk-openai", "gpt-4o");
    expect(model).toBeInstanceOf(ChatOpenAI);
    // @ts-expect-error internal config field
    expect(model.model).toBe("gpt-4o");
  });

  it("routes gemini to ChatGoogleGenerativeAI", () => {
    const model = getChatModel("gemini", "sk-gemini", "gemini-1.5-pro");
    expect(model).toBeInstanceOf(ChatGoogleGenerativeAI);
  });

  it("falls back to the provider default model", () => {
    const model = getChatModel("openai", "sk-openai", "");
    expect(model).toBeInstanceOf(ChatOpenAI);
    // @ts-expect-error internal config field
    expect(model.model).toBe("gpt-4o-mini");
  });

  it("returns embeddings instances per provider", () => {
    expect(getEmbeddings("openai", "sk-openai")).toBeInstanceOf(OpenAIEmbeddings);
    expect(getEmbeddings("gemini", "sk-gemini")).toBeInstanceOf(GoogleGenerativeAIEmbeddings);
  });

  it("throws for an unsupported embeddings provider", () => {
    expect(() => getEmbeddings("claude" as never, "x")).toThrow(/not supported for provider/);
  });
});
