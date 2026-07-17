import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { bio: true } });
    return NextResponse.json({ bio: user?.bio ?? "" });
  } catch (err) {
    return NextResponse.json({ bio: "" });
  }
}
