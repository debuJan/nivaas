import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyOtp } from "@/lib/otp";
import { createSession } from "@/lib/session";

/** Step 2 of login: check the code, open the session. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const phone = String(body?.phone ?? "").trim();
  const code = String(body?.code ?? "").trim();
  if (!/^\d{10}$/.test(phone) || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "Enter the 6-digit code sent to your phone." },
      { status: 400 },
    );
  }
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    return NextResponse.json(
      { error: "This number is not registered with the township office." },
      { status: 404 },
    );
  }
  const live = await prisma.otpCode.findUnique({ where: { phone } });
  const verdict = verifyOtp({
    phone,
    code,
    storedHash: live?.codeHash ?? null,
    expiresAt: live?.expiresAt ?? null,
    attempts: live?.attempts ?? 0,
  });

  if (!verdict.ok) {
    if (verdict.reason === "wrong-code" && live) {
      await prisma.otpCode.update({
        where: { phone },
        data: { attempts: { increment: 1 } },
      });
    }
    const messages: Record<string, string> = {
      "no-code": "No code was requested for this number. Please request a new code.",
      "too-many-attempts": "Too many wrong attempts. Please request a new code.",
      expired: "That code has expired. Please request a new code.",
      "wrong-code": "That code does not match. Please try again.",
    };
    return NextResponse.json(
      { error: messages[verdict.reason] },
      { status: verdict.reason === "too-many-attempts" ? 429 : 401 },
    );
  }

  await prisma.otpCode.deleteMany({ where: { phone } });
  await createSession(user);
  return NextResponse.json({
    user: { id: user.id, name: user.name, role: user.role },
    home:
      user.role === "HELPDESK"
        ? "/helpdesk"
        : user.role === "COMMITTEE"
          ? "/committee"
          : "/",
  });
}
