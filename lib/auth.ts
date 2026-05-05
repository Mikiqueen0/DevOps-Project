import { cookies } from "next/headers";
import { signSessionToken, verifySessionToken } from "@/lib/session-token";
import { prisma } from "@/lib/prisma";

type SessionPayload = {
  userId: string;
  username: string;
};

const SESSION_COOKIE = "pnl_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  // Guard against stale cookies (e.g. seeded user recreated with a new id).
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, username: true }
  });
  if (!user) return null;

  return { userId: user.id, username: user.username };
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return signSessionToken(payload);
}
