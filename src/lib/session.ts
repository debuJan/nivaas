/**
 * Session handling: a signed JWT in an httpOnly cookie.
 *
 * The secret comes from SESSION_SECRET; the fallback below is a clearly
 * marked DEV-ONLY value so the demo runs out of the box. A production
 * deploy must set SESSION_SECRET (see .env.example).
 */
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";

export const SESSION_COOKIE = "nivaas_session";
// DEV ONLY — replace via SESSION_SECRET in any real deployment.
const DEV_SECRET = "dev-only-secret-do-not-use-in-production";
const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? DEV_SECRET,
);

export interface Session {
  userId: string;
  role: Role;
  name: string;
}

export async function createSession(user: {
  id: string;
  role: Role;
  name: string;
}): Promise<void> {
  const token = await new SignJWT({ role: user.role, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 3600,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub || typeof payload.role !== "string") return null;
    return {
      userId: payload.sub,
      role: payload.role as Role,
      name: typeof payload.name === "string" ? payload.name : "",
    };
  } catch {
    return null;
  }
}

/** API guard: returns the session when the role is allowed, else null. */
export async function requireRole(
  ...roles: Role[]
): Promise<Session | null> {
  const session = await getSession();
  if (!session) return null;
  if (roles.length > 0 && !roles.includes(session.role)) return null;
  return session;
}

/** Page guard: redirects to /login, or to the user's own home on role mismatch. */
export async function requirePageSession(...roles: Role[]): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (roles.length > 0 && !roles.includes(session.role)) {
    redirect(
      session.role === "HELPDESK"
        ? "/helpdesk"
        : session.role === "COMMITTEE"
          ? "/committee"
          : "/",
    );
  }
  return session;
}
