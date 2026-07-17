import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAcceptedFriend(myId: string, friendId: string) {
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterId: myId, addresseeId: friendId },
        { requesterId: friendId, addresseeId: myId },
      ],
    },
  });
  return !!friendship;
}

// GET /api/messages/[friendId] — conversation history with a friend
export async function GET(_req: Request, { params }: { params: Promise<{ friendId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { friendId } = await params;
  const myId = session.user.id;

  if (!(await requireAcceptedFriend(myId, friendId))) {
    return NextResponse.json({ error: "Not friends" }, { status: 403 });
  }

  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: myId, receiverId: friendId },
        { senderId: friendId, receiverId: myId },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  // Mark the friend's messages to me as read now that I've fetched the conversation
  await prisma.message.updateMany({
    where: { senderId: friendId, receiverId: myId, readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json(messages);
}

// POST /api/messages/[friendId] — send a text or game invite
export async function POST(req: Request, { params }: { params: Promise<{ friendId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { friendId } = await params;
  const myId = session.user.id;

  if (!(await requireAcceptedFriend(myId, friendId))) {
    return NextResponse.json({ error: "Not friends" }, { status: 403 });
  }

  const { content, type, roomCode } = await req.json();

  if (type === "INVITE") {
    if (!roomCode?.trim()) return NextResponse.json({ error: "Room code required" }, { status: 400 });
    const message = await prisma.message.create({
      data: {
        senderId: myId, receiverId: friendId, type: "INVITE",
        roomCode: roomCode.trim().toUpperCase(),
        content: `invited you to a game — room ${roomCode.trim().toUpperCase()}`,
      },
    });
    return NextResponse.json(message);
  }

  if (!content?.trim()) return NextResponse.json({ error: "Message can't be empty" }, { status: 400 });
  const message = await prisma.message.create({
    data: { senderId: myId, receiverId: friendId, content: content.trim() },
  });
  return NextResponse.json(message);
}
