import { describe, it, expect } from "vitest";
import {
  SUPPORTED_EXTENSIONS,
  UnsupportedFileError,
  extractTextFromFile,
  parseNotionId,
} from "./extractFile";

describe("SUPPORTED_EXTENSIONS", () => {
  it("lists the supported knowledge formats", () => {
    expect(SUPPORTED_EXTENSIONS).toEqual(["pdf", "docx", "txt", "md", "csv"]);
  });
});

describe("parseNotionId", () => {
  it("extracts a 32-hex id from a notion.so URL and lowercases", () => {
    const id = parseNotionId("https://www.notion.so/My-Page-aBcDeF1234567890aBcDeF1234567890");
    expect(id).toBe("abcdef1234567890abcdef1234567890");
  });

  it("accepts a bare 32-hex id", () => {
    expect(parseNotionId("ABCDEF1234567890ABCDEF1234567890")).toBe(
      "abcdef1234567890abcdef1234567890",
    );
  });

  it("strips hyphens from a UUID-style id", () => {
    expect(parseNotionId("12345678-1234-1234-1234-1234567890ab")).toBe(
      "123456781234123412341234567890ab",
    );
  });

  it("accepts notion.com URLs", () => {
    expect(parseNotionId("https://notion.com/page-abcdef1234567890abcdef1234567890")).toBe(
      "abcdef1234567890abcdef1234567890",
    );
  });

  it("throws on a non-notion string without a valid 32-hex id", () => {
    expect(() => parseNotionId("hello")).toThrow(/Could not extract a valid Notion ID/);
  });

  it("throws when a URL has no valid 32-hex id", () => {
    expect(() => parseNotionId("https://www.notion.so/page-name")).toThrow(/Could not extract/);
  });
});

describe("extractTextFromFile", () => {
  it("extracts plain text from txt/md/csv files", async () => {
    for (const ext of ["txt", "md", "csv"]) {
      const file = new File(["hello world\nline 2"], `sample.${ext}`, { type: "text/plain" });
      const text = await extractTextFromFile(file);
      expect(text).toBe("hello world\nline 2");
    }
  });

  it("throws UnsupportedFileError for an unknown extension", async () => {
    const file = new File(["x"], "sample.xyz", { type: "application/octet-stream" });
    await expect(extractTextFromFile(file)).rejects.toThrow(UnsupportedFileError);
  });

  it("throws UnsupportedFileError for uppercase unknown extensions", async () => {
    const file = new File(["x"], "sample.XYZ", { type: "application/octet-stream" });
    await expect(extractTextFromFile(file)).rejects.toThrow(UnsupportedFileError);
  });

  it("reports the resolved extension in the error", async () => {
    try {
      await extractTextFromFile(new File(["x"], "doc.weird"));
    } catch (e) {
      expect(e).toBeInstanceOf(UnsupportedFileError);
      expect((e as Error).message).toBe("weird");
    }
  });
});
