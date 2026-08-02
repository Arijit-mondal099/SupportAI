import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers";
import { getAccountAnalytics } from "./analytics";

const mockDb = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const mockBotFind = vi.hoisted(() => vi.fn());
const mockConvCount = vi.hoisted(() => vi.fn());
const mockConvFind = vi.hoisted(() => vi.fn());
const mockMsgCount = vi.hoisted(() => vi.fn());
const mockAgg = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db_connection: mockDb }));
vi.mock("@/models/chatbot.model", () => ({ ChatbotModel: { find: mockBotFind } }));
vi.mock("@/models/conversation.model", () => ({
  ConversationModel: { countDocuments: mockConvCount, find: mockConvFind },
}));
vi.mock("@/models/message.model", () => ({
  MessageModel: { countDocuments: mockMsgCount, aggregate: mockAgg },
}));

const liveBot = { _id: "b1", name: "Live Bot", status: "live" };
const draftBot = { _id: "b2", name: "Draft Bot", status: "draft" };

const todayKey = new Date().toISOString().slice(0, 10);

beforeEach(() => {
  vi.clearAllMocks();

  mockDb.mockReset().mockResolvedValue({});
  mockBotFind.mockReset();
  mockConvCount.mockReset().mockResolvedValue(5);
  mockConvFind.mockReset();
  mockMsgCount.mockReset().mockResolvedValue(42);
  mockAgg.mockReset(); // first call -> daily, second -> top
});

describe("getAccountAnalytics", () => {
  const wireCommon = () => {
    mockBotFind.mockReturnValue(makeChain([liveBot, draftBot]));
    // aggregate is called twice: daily first, top agents second
    mockAgg.mockResolvedValueOnce([{ _id: todayKey, count: 3 }]).mockResolvedValueOnce([
      { _id: "b1", count: 10 },
      { _id: "b2", count: 2 },
      { _id: "b9", count: 1 },
    ]);
    mockConvFind.mockReturnValue(
      makeChain([
        {
          _id: "c1",
          botId: "b1",
          messageCount: 12,
          lastMessageAt: new Date("2026-08-01T00:00:00.000Z"),
        },
        { _id: "c2", botId: "b9", messageCount: 1, lastMessageAt: null },
      ]),
    );
  };

  it("returns totals scoped to the owner's bots", async () => {
    wireCommon();
    const out = await getAccountAnalytics("owner_1");

    expect(out.totals.agents).toBe(2);
    expect(out.totals.liveAgents).toBe(1);
    expect(out.totals.conversations).toBe(5);
    expect(out.totals.messages).toBe(42);
  });

  it("builds a 14-day window with only the matching day populated", async () => {
    wireCommon();
    const out = await getAccountAnalytics("owner_1");

    expect(out.daily).toHaveLength(14);
    const populated = out.daily.filter((d) => d.messages > 0);
    expect(populated).toHaveLength(1);
    expect(populated[0].messages).toBe(3);
    // labels are M/D (no leading zeros)
    expect(out.daily.every((d) => /^\d+\/\d+$/.test(d.label))).toBe(true);
  });

  it("maps top agents from bot metadata with defaults for unknowns", async () => {
    wireCommon();
    const out = await getAccountAnalytics("owner_1");

    expect(out.topAgents).toHaveLength(3);
    expect(out.topAgents[0]).toEqual({ _id: "b1", name: "Live Bot", status: "live", messages: 10 });
    expect(out.topAgents[1]).toEqual({
      _id: "b2",
      name: "Draft Bot",
      status: "draft",
      messages: 2,
    });
    // b9 is not in the bot list -> falls back to defaults
    expect(out.topAgents[2]).toEqual({ _id: "b9", name: "Untitled", status: "draft", messages: 1 });
  });

  it("maps recent conversations with bot names, falling back to 'Agent'", async () => {
    wireCommon();
    const out = await getAccountAnalytics("owner_1");

    expect(out.recent).toHaveLength(2);
    expect(out.recent[0]).toEqual({
      _id: "c1",
      botName: "Live Bot",
      messageCount: 12,
      lastMessageAt: "2026-08-01T00:00:00.000Z",
    });
    // b9 unknown -> 'Agent', and null lastMessageAt stays null
    expect(out.recent[1]).toEqual({
      _id: "c2",
      botName: "Agent",
      messageCount: 1,
      lastMessageAt: null,
    });
  });

  it("returns zeroes/empty collections when the owner has no bots", async () => {
    mockBotFind.mockReturnValue(makeChain([])); // no bots
    mockConvFind.mockReturnValue(makeChain([])); // no recent convos

    const out = await getAccountAnalytics("owner_1");

    expect(out.totals.agents).toBe(0);
    expect(out.totals.liveAgents).toBe(0);
    expect(out.totals.messages).toBe(0);
    expect(out.topAgents).toEqual([]);
    expect(out.recent).toEqual([]);
    // aggregates are not queried when there are no bot ids
    expect(mockAgg).not.toHaveBeenCalled();
    expect(mockMsgCount).not.toHaveBeenCalled();
  });
});
