import { describe, expect, it } from "vitest";
import {
  isOrphanToolResultError,
  parseOrphanToolResultError,
} from "./pi-embedded-helpers/errors.js";

describe("isOrphanToolResultError", () => {
  it("matches unexpected tool_use_id error", () => {
    expect(
      isOrphanToolResultError("unexpected tool_use_id found in tool_result blocks: toolu_abc123"),
    ).toBe(true);
  });

  it("matches tool_result must have corresponding tool_use error", () => {
    expect(
      isOrphanToolResultError("tool_result block must have a corresponding tool_use block"),
    ).toBe(true);
  });

  it("matches tool_result references tool_use_id not found error", () => {
    expect(
      isOrphanToolResultError(
        'tool_result block references tool_use_id "toolu_xyz789" not found in conversation',
      ),
    ).toBe(true);
  });

  it("is case insensitive", () => {
    expect(
      isOrphanToolResultError("UNEXPECTED TOOL_USE_ID FOUND IN TOOL_RESULT BLOCKS: toolu_abc123"),
    ).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isOrphanToolResultError("rate limit exceeded")).toBe(false);
    expect(isOrphanToolResultError("invalid api key")).toBe(false);
    expect(isOrphanToolResultError("context length exceeded")).toBe(false);
    expect(isOrphanToolResultError("string should match pattern")).toBe(false);
  });

  it("returns false for empty or undefined input", () => {
    expect(isOrphanToolResultError("")).toBe(false);
    expect(isOrphanToolResultError(undefined)).toBe(false);
  });
});

describe("parseOrphanToolResultError", () => {
  it("extracts tool_use_id from error message", () => {
    const result = parseOrphanToolResultError(
      'unexpected tool_use_id found in tool_result blocks: tool_use_id "toolu_abc123"',
    );
    expect(result).not.toBeNull();
    expect(result?.toolUseId).toBe("toolu_abc123");
  });

  it("extracts tool_use_id with quotes", () => {
    const result = parseOrphanToolResultError(
      'tool_result block references tool_use_id "toolu_xyz789" not found in conversation',
    );
    expect(result).not.toBeNull();
    expect(result?.toolUseId).toBe("toolu_xyz789");
  });

  it("extracts message and content indices from error path", () => {
    const result = parseOrphanToolResultError(
      'unexpected tool_use_id found in tool_result blocks at messages.5.content.2: tool_use_id "toolu_def456"',
    );
    expect(result).not.toBeNull();
    expect(result?.toolUseId).toBe("toolu_def456");
    expect(result?.messageIndex).toBe(5);
    expect(result?.contentIndex).toBe(2);
  });

  it("returns null for non-orphan errors", () => {
    expect(parseOrphanToolResultError("rate limit exceeded")).toBeNull();
    expect(parseOrphanToolResultError("invalid api key")).toBeNull();
  });

  it("returns null for empty or undefined input", () => {
    expect(parseOrphanToolResultError("")).toBeNull();
    expect(parseOrphanToolResultError(undefined)).toBeNull();
  });

  it("returns null when tool_use_id cannot be extracted", () => {
    // This matches isOrphanToolResultError but has no extractable ID
    expect(
      parseOrphanToolResultError("tool_result must have corresponding tool_use block"),
    ).toBeNull();
  });
});
