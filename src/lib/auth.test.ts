import { describe, it, expect, vi } from "vitest";
import { requireOwner } from "./auth";

const mockGetUserSession = vi.hoisted(() => vi.fn());
vi.mock("./getUserSession", () => ({ getUserSession: mockGetUserSession }));

describe("requireOwner", () => {
  it("returns null when there is no session", async () => {
    mockGetUserSession.mockResolvedValue(null);
    await expect(requireOwner()).resolves.toBeNull();
  });

  it("returns null when the session has no user id", async () => {
    mockGetUserSession.mockResolvedValue({ user: {} });
    await expect(requireOwner()).resolves.toBeNull();
  });

  it("maps a session user to { ownerId, email }", async () => {
    mockGetUserSession.mockResolvedValue({ user: { id: "u_123", email: "a@b.com" } });
    await expect(requireOwner()).resolves.toEqual({ ownerId: "u_123", email: "a@b.com" });
  });

  it("defaults email to empty string when absent", async () => {
    mockGetUserSession.mockResolvedValue({ user: { id: "u_123" } });
    await expect(requireOwner()).resolves.toEqual({ ownerId: "u_123", email: "" });
  });
});
