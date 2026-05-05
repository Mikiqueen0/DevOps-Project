import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";
import { normalizeDateOnly } from "@/lib/pnl";

export const runtime = "nodejs";

const entrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().finite().min(-1_000_000_000).max(1_000_000_000)
});

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entries = await prisma.pnlEntry.findMany({
    where: { userId: session.userId },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }]
  });

  return NextResponse.json(entries);
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = entrySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid entry payload." }, { status: 400 });
  }

  const normalizedDate = normalizeDateOnly(parsed.data.date);
  const entry = await prisma.pnlEntry.upsert({
    where: {
      userId_date: {
        userId: session.userId,
        date: normalizedDate
      }
    },
    create: {
      userId: session.userId,
      date: normalizedDate,
      amount: parsed.data.amount
    },
    update: {
      amount: parsed.data.amount
    }
  });

  return NextResponse.json(entry, { status: 201 });
}

