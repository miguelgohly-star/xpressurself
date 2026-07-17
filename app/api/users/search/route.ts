import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/users/search?q=... — find users by username, for adding friends
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json([]);

  const users = await prisma.user.findMany({
    where: {
      username: { contains: q },
      id: { not: session.user.id },
    },
    select: { id: true, username: true, image: true },
    take: 8,
  });

  return NextResponse.json(users);
}
