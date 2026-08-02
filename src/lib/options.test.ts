import { describe, it, expect } from "vitest";
import {
  normalizeProvider,
  supportsEmbeddings,
  defaultModel,
  withCurrent,
  MODELS,
  PROVIDERS,
  INDUSTRIES,
  TONES,
} from "./options";

describe("normalizeProvider", () => {
  it("returns openai for openai", () => {
    expect(normalizeProvider("openai")).toBe("openai");
  });

  it("falls back to gemini for anything else", () => {
    expect(normalizeProvider("gemini")).toBe("gemini");
    expect(normalizeProvider("claude")).toBe("gemini");
    expect(normalizeProvider(undefined)).toBe("gemini");
    expect(normalizeProvider("")).toBe("gemini");
  });
});

describe("supportsEmbeddings", () => {
  it("supports gemini and openai", () => {
    expect(supportsEmbeddings("gemini")).toBe(true);
    expect(supportsEmbeddings("openai")).toBe(true);
  });
});

describe("defaultModel", () => {
  it("returns the first model of each provider", () => {
    expect(defaultModel("gemini")).toBe(MODELS.gemini[0].value);
    expect(defaultModel("openai")).toBe(MODELS.openai[0].value);
  });
});

describe("withCurrent", () => {
  it("returns options unchanged when current is missing", () => {
    expect(withCurrent(["a", "b"], undefined)).toEqual(["a", "b"]);
  });

  it("returns options unchanged when current already present", () => {
    expect(withCurrent(["a", "b"], "b")).toEqual(["a", "b"]);
  });

  it("prepends current when not present", () => {
    expect(withCurrent(["a", "b"], "z")).toEqual(["z", "a", "b"]);
  });
});

describe("option lists", () => {
  it("exports providers, industries and tones", () => {
    expect(PROVIDERS).toHaveLength(2);
    expect(INDUSTRIES).toContain("E-commerce");
    expect(TONES).toContain("Professional");
  });

  it("includes expected default models", () => {
    expect(MODELS.gemini.map((m) => m.value)).toContain("gemini-2.0-flash");
    expect(MODELS.openai.map((m) => m.value)).toContain("gpt-4o-mini");
  });
});
