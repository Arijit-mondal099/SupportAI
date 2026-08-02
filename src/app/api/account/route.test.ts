import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, PUT } from "./route";
import { OWNER, makeChain } from "@/tests/helpers";

const mockRequireOwner = vi.hoisted(() => vi.fn());
const mockFindOne = vi.hoisted(() => vi.fn());
const mockUpdateOne = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireOwner: mockRequireOwner }));
vi.mock("@/lib/db", () => ({ db_connection: vi.fn().mockResolvedValue({}) }));
vi.mock("@/models/owner.model", () => ({
  OwnerModel: { findOne: mockFindOne, updateOne: mockUpdateOne },
}));

const jsonReq = (body: unknown) =>
  new NextRequest("https://example.com/api/account", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireOwner.mockReset();
  mockFindOne.mockReset();
  mockUpdateOne.mockReset().mockResolvedValue({ acknowledged: true, modifiedCount: 1 });
});

describe("GET /api/account", () => {
  it("returns 401 when not authenticated", async () => {
    mockRequireOwner.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("reports hasNotionIntegration=true when a token is stored", async () => {
    mockRequireOwner.mockResolvedValue(OWNER);
    mockFindOne.mockReturnValue(makeChain({ notionIntegrationToken: "secret-token" }));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.hasNotionIntegration).toBe(true);
    expect(mockFindOne).toHaveBeenCalledWith({ ownerId: "owner_1" });
  });

  it("reports hasNotionIntegration=false when no doc exists", async () => {
    mockRequireOwner.mockResolvedValue(OWNER);
    mockFindOne.mockReturnValue(makeChain(null));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.hasNotionIntegration).toBe(false);
  });

  it("reports hasNotionIntegration=false when the token is empty", async () => {
    mockRequireOwner.mockResolvedValue(OWNER);
    mockFindOne.mockReturnValue(makeChain({ notionIntegrationToken: "" }));

    const res = await GET();
    const body = await res.json();

    expect(body.hasNotionIntegration).toBe(false);
  });
});

describe("PUT /api/account", () => {
  it("returns 401 when not authenticated", async () => {
    mockRequireOwner.mockResolvedValue(null);
    const res = await PUT(jsonReq({ notionIntegrationToken: "tok" }));
    expect(res.status).toBe(401);
    expect(mockUpdateOne).not.toHaveBeenCalled();
  });

  it("sets and trims the notion token", async () => {
    mockRequireOwner.mockResolvedValue(OWNER);

    const res = await PUT(jsonReq({ notionIntegrationToken: "  trimmed-token  " }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.hasNotionIntegration).toBe(true);
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { ownerId: "owner_1" },
      { $set: { notionIntegrationToken: "trimmed-token" } },
      { upsert: true },
    );
  });

  it("empties the token when an empty string is sent", async () => {
    mockRequireOwner.mockResolvedValue(OWNER);

    const res = await PUT(jsonReq({ notionIntegrationToken: "" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.hasNotionIntegration).toBe(false);
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { ownerId: "owner_1" },
      { $set: { notionIntegrationToken: "" } },
      { upsert: true },
    );
  });
});
