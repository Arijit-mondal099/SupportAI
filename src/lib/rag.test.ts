import { describe, it, expect, vi } from "vitest";

// Provide a mutable ENV so isRagConfigured's true/false branches can be tested
// in the same file. vi.hoisted ensures the reference is initialized before the
// (hoisted) vi.mock factory below runs.
const mockENV = vi.hoisted(() => ({ PINECONE_API_KEY: "", PINECONE_INDEX: "" }));
vi.mock("./env", () => ({ ENV: mockENV }));

import { isRagConfigured, splitText } from "./rag";

describe("isRagConfigured", () => {
  it("returns false when nothing is configured", () => {
    mockENV.PINECONE_API_KEY = "";
    mockENV.PINECONE_INDEX = "";
    expect(isRagConfigured()).toBe(false);
  });

  it("returns false when only one of the two is set", () => {
    mockENV.PINECONE_API_KEY = "key";
    mockENV.PINECONE_INDEX = "";
    expect(isRagConfigured()).toBe(false);

    mockENV.PINECONE_API_KEY = "";
    mockENV.PINECONE_INDEX = "idx";
    expect(isRagConfigured()).toBe(false);
  });

  it("returns true only when both are configured", () => {
    mockENV.PINECONE_API_KEY = "";
    mockENV.PINECONE_INDEX = "idx";
    expect(isRagConfigured()).toBe(false);

    mockENV.PINECONE_API_KEY = "key";
    expect(isRagConfigured()).toBe(true);
  });
});

describe("splitText", () => {
  it("returns an empty array for blank input", async () => {
    expect(await splitText("   ")).toEqual([]);
    expect(await splitText("")).toEqual([]);
  });

  it("collapses whitespace and splits a short string into one chunk", async () => {
    const out = await splitText("  hello   world  ");
    expect(out).toEqual(["hello world"]);
  });

  it("splits a long document into multiple chunks", async () => {
    const long = Array.from({ length: 200 }, (_, i) => `sentence number ${i}.`).join(" ");
    const out = await splitText(long);
    expect(out.length).toBeGreaterThan(1);
    expect(out.every((c) => c.length > 0)).toBe(true);
  });
});
