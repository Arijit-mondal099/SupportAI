import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn (clsx + tailwind-merge)", () => {
  it("joins simple class strings", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("drops falsy values", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("resolves conflicting tailwind utilities to the last one", () => {
    expect(cn("p-2 p-4")).toBe("p-4");
    expect(cn("text-sm text-lg font-bold")).toBe("text-lg font-bold");
  });

  it("handles conditional objects", () => {
    expect(cn({ "is-active": true, hidden: false })).toBe("is-active");
  });
});
