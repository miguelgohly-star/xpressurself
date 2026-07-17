import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/wheels — list user's wheels
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const wheels = await prisma.categoryPack.findMany({
    where: { userId: session.user.id },
    include: { categories: { orderBy: { id: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(wheels);
}

// POST /api/wheels — create a new wheel
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description, categories } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  if (!categories?.length || categories.length < 2)
    return NextResponse.json({ error: "Add at least 2 categories" }, { status: 400 });

  const pack = await prisma.categoryPack.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      userId: session.user.id,
      categories: {
        create: (categories as string[])
          .map((c: string) => c.trim())
          .filter(Boolean)
          .map((name: string) => ({ name })),
      },
    },
    include: { categories: true },
  });

  return NextResponse.json(pack);
}
