import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function ownsWheel(userId: string, id: string) {
  const pack = await prisma.categoryPack.findUnique({ where: { id } });
  return pack?.userId === userId ? pack : null;
}

// PATCH /api/wheels/[id] — rename wheel
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const pack = await ownsWheel(session.user.id, id);
  if (!pack) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name, description, categories } = await req.json();

  // Replace all categories if provided
  if (categories) {
    await prisma.category.deleteMany({ where: { packId: id } });
    await prisma.category.createMany({
      data: (categories as string[])
        .map((c: string) => c.trim())
        .filter(Boolean)
        .map((name: string) => ({ name, packId: id })),
    });
  }

  const updated = await prisma.categoryPack.update({
    where: { id },
    data: {
      ...(name ? { name: name.trim() } : {}),
      ...(description !== undefined ? { description: description?.trim() || null } : {}),
    },
    include: { categories: { orderBy: { id: "asc" } } },
  });

  return NextResponse.json(updated);
}

// DELETE /api/wheels/[id] — delete wheel
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const pack = await ownsWheel(session.user.id, id);
  if (!pack) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.categoryPack.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
