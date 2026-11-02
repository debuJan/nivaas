/**
 * OTP helpers for the mock-SMS login.
 *
 * The flow is real — a 6-digit code is generated per request, only its
 * SHA-256 hash is stored, it expires in 5 minutes and allows 5 guesses —
 * only the delivery channel is mocked. For the reviewer demo, the fixed
 * code DEMO_CODE is also accepted for any registered phone (stated openly
 * in the README; a production build would drop it and wire a real SMS
 * provider where the console.log in the request route stands).
 */
import { createHash, randomInt } from "crypto";

export const DEMO_CODE = "123456";
export const OTP_TTL_MS = 5 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;

export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtp(phone: string, code: string): string {
  return createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

export interface OtpCheck {
  phone: string;
  code: string;
  /** Hash stored when the code was issued; null when no code is live. */
  storedHash: string | null;
  expiresAt: Date | null;
  attempts: number;
  now?: Date;
}

export type OtpVerdict =
  | { ok: true; viaDemo: boolean }
  | { ok: false; reason: "no-code" | "too-many-attempts" | "expired" | "wrong-code" };

export function verifyOtp(input: OtpCheck): OtpVerdict {
  const now = input.now ?? new Date();
  // The demo shortcut is checked first and never consumes attempts.
  if (input.code === DEMO_CODE) return { ok: true, viaDemo: true };
  if (!input.storedHash || !input.expiresAt) return { ok: false, reason: "no-code" };
  if (input.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: "too-many-attempts" };
  if (input.expiresAt.getTime() < now.getTime()) return { ok: false, reason: "expired" };
  if (hashOtp(input.phone, input.code) !== input.storedHash) {
    return { ok: false, reason: "wrong-code" };
  }
  return { ok: true, viaDemo: false };
}
