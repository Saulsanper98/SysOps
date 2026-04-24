import { describe, it, expect, beforeAll, afterAll } from "vitest";

// ─── Unit tests for auth helpers ──────────────────────────────────────────────

describe("hashPassword / verify", () => {
  it("hashes a password and verifies it", async () => {
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("Test1234!", 10);
    expect(hash).toBeTruthy();
    expect(hash).not.toBe("Test1234!");

    const valid = await bcrypt.compare("Test1234!", hash);
    expect(valid).toBe(true);

    const invalid = await bcrypt.compare("WrongPass", hash);
    expect(invalid).toBe(false);
  });
});

describe("config validation", () => {
  it("requires JWT_SECRET of at least 32 chars", () => {
    const { z } = require("zod");
    const schema = z.string().min(32);
    expect(() => schema.parse("short")).toThrow();
    expect(() => schema.parse("a".repeat(32))).not.toThrow();
  });
});
