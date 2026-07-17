import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const count = await prisma.user.count();
    return NextResponse.json({ ok: true, users: count });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message, stack: err?.stack?.split("\n").slice(0,5) }, { status: 500 });
  }
}
