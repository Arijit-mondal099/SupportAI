import { describe, it, expect } from "vitest";
import { resolveProviderKey } from "./providerKey";
import { defaultModel } from "./options";

describe("resolveProviderKey", () => {
  it("returns explicitly configured provider, key and model", () => {
    const r = resolveProviderKey({
      provider: "openai",
      apiKeyOverride: "sk-abc",
      model: "gpt-4o",
    });
    expect(r).toEqual({ provider: "openai", apiKey: "sk-abc", model: "gpt-4o" });
  });

  it("falls back to the provider default model when model is empty", () => {
    const r = resolveProviderKey({ provider: "openai", apiKeyOverride: "sk-abc", model: "" });
    expect(r.model).toBe(defaultModel("openai"));
  });

  it("normalizes a missing/foreign provider to gemini", () => {
    const r = resolveProviderKey({ provider: undefined, apiKeyOverride: "x", model: "" });
    expect(r.provider).toBe("gemini");
    expect(r.model).toBe(defaultModel("gemini"));
  });

  it("trims the api key and model", () => {
    const r = resolveProviderKey({
      provider: "openai",
      apiKeyOverride: "  sk-trim  ",
      model: "  gpt-4o  ",
    });
    expect(r.apiKey).toBe("sk-trim");
    expect(r.model).toBe("gpt-4o");
  });

  it("returns an empty api key when not configured", () => {
    const r = resolveProviderKey({
      provider: undefined,
      apiKeyOverride: undefined,
      model: undefined,
    });
    expect(r.apiKey).toBe("");
  });
});
