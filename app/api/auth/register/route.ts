import * as bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, cleanupRateLimitBuckets } from "@/lib/rate-limit";
import { setSessionCookie, signSession } from "@/lib/auth";

export const runtime = "nodejs";

const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  password: z
    .string()
    .min(8)
    .max(72)
    .regex(/[A-Z]/, "Password must include at least one uppercase letter")
    .regex(/[a-z]/, "Password must include at least one lowercase letter")
    .regex(/[0-9]/, "Password must include at least one number")
});

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: NextRequest) {
  cleanupRateLimitBuckets();
  const ip = getClientIp(request);
  const rate = checkRateLimit(`register:${ip}`, 8, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait and try again." }, { status: 429 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(payload);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]?.message;
    return NextResponse.json({ error: firstError ?? "Invalid registration data." }, { status: 400 });
  }

  const username = parsed.data.username.toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { username } });
  if (existingUser) {
    return NextResponse.json({ error: "Username is already taken." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: { username, passwordHash }
  });

  const token = await signSession({ userId: user.id, username: user.username });
  await setSessionCookie(token);

  return NextResponse.json({ ok: true, user: { id: user.id, username: user.username } });
}
