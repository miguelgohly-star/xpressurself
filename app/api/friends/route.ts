import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const userFields = { id: true, username: true, image: true } as const;

// GET /api/friends — accepted friends, plus incoming/outgoing pending requests
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const myId = session.user.id;

  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ requesterId: myId }, { addresseeId: myId }] },
    include: { requester: { select: userFields }, addressee: { select: userFields } },
    orderBy: { createdAt: "desc" },
  });

  const friends = friendships
    .filter((f) => f.status === "ACCEPTED")
    .map((f) => (f.requesterId === myId ? f.addressee : f.requester));

  const incoming = friendships
    .filter((f) => f.status === "PENDING" && f.addresseeId === myId)
    .map((f) => ({ friendshipId: f.id, user: f.requester }));

  const outgoing = friendships
    .filter((f) => f.status === "PENDING" && f.requesterId === myId)
    .map((f) => ({ friendshipId: f.id, user: f.addressee }));

  return NextResponse.json({ friends, incoming, outgoing });
}

// POST /api/friends — send a friend request by username
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const myId = session.user.id;

  const { username } = await req.json();
  if (!username?.trim()) return NextResponse.json({ error: "Username required" }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { username: username.trim() } });
  if (!target) return NextResponse.json({ error: "No player with that username" }, { status: 404 });
  if (target.id === myId) return NextResponse.json({ error: "That's you" }, { status: 400 });

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: myId, addresseeId: target.id },
        { requesterId: target.id, addresseeId: myId },
      ],
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: existing.status === "ACCEPTED" ? "Already friends" : "Request already pending" },
      { status: 400 }
    );
  }

  const friendship = await prisma.friendship.create({
    data: { requesterId: myId, addresseeId: target.id },
    include: { addressee: { select: userFields } },
  });

  return NextResponse.json({ friendshipId: friendship.id, user: friendship.addressee });
}
