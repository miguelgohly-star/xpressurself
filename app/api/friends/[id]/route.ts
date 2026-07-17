import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/friends/[id] — accept a pending request
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const friendship = await prisma.friendship.findUnique({ where: { id } });
  if (!friendship || friendship.addresseeId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.friendship.update({
    where: { id },
    data: { status: "ACCEPTED" },
  });
  return NextResponse.json(updated);
}

// DELETE /api/friends/[id] — decline a request or remove a friend
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const friendship = await prisma.friendship.findUnique({ where: { id } });
  if (!friendship || (friendship.requesterId !== session.user.id && friendship.addresseeId !== session.user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.friendship.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
