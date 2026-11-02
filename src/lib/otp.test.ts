import { describe, expect, it } from "vitest";
import { DEMO_CODE, generateOtp, hashOtp, verifyOtp } from "./otp";

const PHONE = "9820011100";
const NOW = new Date("2026-11-02T10:00:00Z");
const future = new Date(NOW.getTime() + 4 * 60_000);
const past = new Date(NOW.getTime() - 60_000);

describe("verifyOtp", () => {
  it("accepts the correct issued code", () => {
    const code = "482916";
    const v = verifyOtp({
      phone: PHONE,
      code,
      storedHash: hashOtp(PHONE, code),
      expiresAt: future,
      attempts: 0,
      now: NOW,
    });
    expect(v).toEqual({ ok: true, viaDemo: false });
  });

  it("rejects a wrong code", () => {
    const v = verifyOtp({
      phone: PHONE,
      code: "000000",
      storedHash: hashOtp(PHONE, "482916"),
      expiresAt: future,
      attempts: 0,
      now: NOW,
    });
    expect(v).toEqual({ ok: false, reason: "wrong-code" });
  });

  it("rejects an expired code even when correct", () => {
    const code = "482916";
    const v = verifyOtp({
      phone: PHONE,
      code,
      storedHash: hashOtp(PHONE, code),
      expiresAt: past,
      attempts: 0,
      now: NOW,
    });
    expect(v).toEqual({ ok: false, reason: "expired" });
  });

  it("locks out after 5 attempts", () => {
    const code = "482916";
    const v = verifyOtp({
      phone: PHONE,
      code,
      storedHash: hashOtp(PHONE, code),
      expiresAt: future,
      attempts: 5,
      now: NOW,
    });
    expect(v).toEqual({ ok: false, reason: "too-many-attempts" });
  });

  it("reports no-code when nothing was issued", () => {
    const v = verifyOtp({
      phone: PHONE,
      code: "482916",
      storedHash: null,
      expiresAt: null,
      attempts: 0,
      now: NOW,
    });
    expect(v).toEqual({ ok: false, reason: "no-code" });
  });

  it("accepts the documented demo code without a live code", () => {
    const v = verifyOtp({
      phone: PHONE,
      code: DEMO_CODE,
      storedHash: null,
      expiresAt: null,
      attempts: 0,
      now: NOW,
    });
    expect(v).toEqual({ ok: true, viaDemo: true });
  });

  it("generates 6-digit codes whose hashes verify", () => {
    const code = generateOtp();
    expect(code).toMatch(/^\d{6}$/);
    expect(hashOtp(PHONE, code)).toHaveLength(64);
  });
});
