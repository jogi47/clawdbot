import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { describe, expect, it } from "vitest";
import {
  repairToolUseResultPairing,
  sanitizeToolUseResultPairing,
} from "./session-transcript-repair.js";

describe("sanitizeToolUseResultPairing", () => {
  it("moves tool results directly after tool calls and inserts missing results", () => {
    const input = [
      {
        role: "assistant",
        content: [
          { type: "toolCall", id: "call_1", name: "read", arguments: {} },
          { type: "toolCall", id: "call_2", name: "exec", arguments: {} },
        ],
      },
      { role: "user", content: "user message that should come after tool use" },
      {
        role: "toolResult",
        toolCallId: "call_2",
        toolName: "exec",
        content: [{ type: "text", text: "ok" }],
        isError: false,
      },
    ] satisfies AgentMessage[];

    const out = sanitizeToolUseResultPairing(input);
    expect(out[0]?.role).toBe("assistant");
    expect(out[1]?.role).toBe("toolResult");
    expect((out[1] as { toolCallId?: string }).toolCallId).toBe("call_1");
    expect(out[2]?.role).toBe("toolResult");
    expect((out[2] as { toolCallId?: string }).toolCallId).toBe("call_2");
    expect(out[3]?.role).toBe("user");
  });

  it("drops duplicate tool results for the same id within a span", () => {
    const input = [
      {
        role: "assistant",
        content: [{ type: "toolCall", id: "call_1", name: "read", arguments: {} }],
      },
      {
        role: "toolResult",
        toolCallId: "call_1",
        toolName: "read",
        content: [{ type: "text", text: "first" }],
        isError: false,
      },
      {
        role: "toolResult",
        toolCallId: "call_1",
        toolName: "read",
        content: [{ type: "text", text: "second" }],
        isError: false,
      },
      { role: "user", content: "ok" },
    ] satisfies AgentMessage[];

    const out = sanitizeToolUseResultPairing(input);
    expect(out.filter((m) => m.role === "toolResult")).toHaveLength(1);
  });

  it("drops duplicate tool results for the same id across the transcript", () => {
    const input = [
      {
        role: "assistant",
        content: [{ type: "toolCall", id: "call_1", name: "read", arguments: {} }],
      },
      {
        role: "toolResult",
        toolCallId: "call_1",
        toolName: "read",
        content: [{ type: "text", text: "first" }],
        isError: false,
      },
      { role: "assistant", content: [{ type: "text", text: "ok" }] },
      {
        role: "toolResult",
        toolCallId: "call_1",
        toolName: "read",
        content: [{ type: "text", text: "second (duplicate)" }],
        isError: false,
      },
    ] satisfies AgentMessage[];

    const out = sanitizeToolUseResultPairing(input);
    const results = out.filter((m) => m.role === "toolResult") as Array<{
      toolCallId?: string;
    }>;
    expect(results).toHaveLength(1);
    expect(results[0]?.toolCallId).toBe("call_1");
  });

  it("drops orphan tool results that do not match any tool call", () => {
    const input = [
      { role: "user", content: "hello" },
      {
        role: "toolResult",
        toolCallId: "call_orphan",
        toolName: "read",
        content: [{ type: "text", text: "orphan" }],
        isError: false,
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "ok" }],
      },
    ] satisfies AgentMessage[];

    const out = sanitizeToolUseResultPairing(input);
    expect(out.some((m) => m.role === "toolResult")).toBe(false);
    expect(out.map((m) => m.role)).toEqual(["user", "assistant"]);
  });
});

describe("repairToolUseResultPairing", () => {
  it("tracks dropped orphan IDs in the report", () => {
    const input = [
      { role: "user", content: "hello" },
      {
        role: "toolResult",
        toolCallId: "toolu_orphan_1",
        toolName: "read",
        content: [{ type: "text", text: "orphan 1" }],
        isError: false,
      },
      {
        role: "assistant",
        content: [{ type: "toolCall", id: "call_1", name: "exec", arguments: {} }],
      },
      {
        role: "toolResult",
        toolCallId: "call_1",
        toolName: "exec",
        content: [{ type: "text", text: "ok" }],
        isError: false,
      },
      {
        role: "toolResult",
        toolCallId: "toolu_orphan_2",
        toolName: "write",
        content: [{ type: "text", text: "orphan 2" }],
        isError: false,
      },
    ] as AgentMessage[];

    const report = repairToolUseResultPairing(input);
    expect(report.droppedOrphanCount).toBe(2);
    expect(report.droppedOrphanIds).toContain("toolu_orphan_1");
    expect(report.droppedOrphanIds).toContain("toolu_orphan_2");
    expect(report.droppedOrphanIds).toHaveLength(2);
  });

  it("reports empty droppedOrphanIds when no orphans exist", () => {
    const input = [
      {
        role: "assistant",
        content: [{ type: "toolCall", id: "call_1", name: "exec", arguments: {} }],
      },
      {
        role: "toolResult",
        toolCallId: "call_1",
        toolName: "exec",
        content: [{ type: "text", text: "ok" }],
        isError: false,
      },
    ] as AgentMessage[];

    const report = repairToolUseResultPairing(input);
    expect(report.droppedOrphanCount).toBe(0);
    expect(report.droppedOrphanIds).toEqual([]);
  });

  it("tracks orphan IDs from mismatched tool results within assistant spans", () => {
    const input = [
      {
        role: "assistant",
        content: [{ type: "toolCall", id: "call_1", name: "exec", arguments: {} }],
      },
      {
        role: "toolResult",
        toolCallId: "call_1",
        toolName: "exec",
        content: [{ type: "text", text: "ok" }],
        isError: false,
      },
      {
        role: "toolResult",
        toolCallId: "toolu_wrong_id",
        toolName: "read",
        content: [{ type: "text", text: "wrong" }],
        isError: false,
      },
      { role: "user", content: "next" },
    ] as AgentMessage[];

    const report = repairToolUseResultPairing(input);
    expect(report.droppedOrphanCount).toBe(1);
    expect(report.droppedOrphanIds).toContain("toolu_wrong_id");
  });
});
