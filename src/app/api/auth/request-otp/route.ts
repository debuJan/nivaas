import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateOtp, hashOtp, OTP_TTL_MS } from "@/lib/otp";

/**
 * Step 1 of login. The phone must belong to a seeded user — an unknown
 * number gets a friendly 404, not a code. The generated code is "sent" by
 * the mock SMS gateway, which in this build is the server log.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const phone = String(body?.phone ?? "").trim();
  if (!/^\d{10}$/.test(phone)) {
    return NextResponse.json(
      { error: "Enter a 10-digit mobile number." },
      { status: 400 },
    );
  }
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    return NextResponse.json(
      { error: "This number is not registered with the township office. Please check the number, or contact the help desk." },
      { status: 404 },
    );
  }
  const code = generateOtp();
  await prisma.otpCode.upsert({
    where: { phone },
    create: {
      phone,
      codeHash: hashOtp(phone, code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      attempts: 0,
    },
    update: {
      codeHash: hashOtp(phone, code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      attempts: 0,
    },
  });
  // Mock SMS gateway: in production this line is the SMS provider call.
  console.log(`[mock-sms] OTP for ${phone}: ${code}`);
  return NextResponse.json({ sent: true, name: user.name });
}
