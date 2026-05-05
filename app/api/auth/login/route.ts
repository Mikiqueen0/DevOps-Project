import * as bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, cleanupRateLimitBuckets } from "@/lib/rate-limit";
import { setSessionCookie, signSession } from "@/lib/auth";

export const runtime = "nodejs";

const loginSchema = z.object({
  username: z.string().min(1).max(30),
  password: z.string().min(1).max(72)
});

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: NextRequest) {
  cleanupRateLimitBuckets();
  const ip = getClientIp(request);
  const rate = checkRateLimit(`login:${ip}`, 10, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait and try again." }, { status: 429 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid login data." }, { status: 400 });
  }

  const username = parsed.data.username.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const isValid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const token = await signSession({ userId: user.id, username: user.username });
  await setSessionCookie(token);

  return NextResponse.json({ ok: true, user: { id: user.id, username: user.username } });
}
