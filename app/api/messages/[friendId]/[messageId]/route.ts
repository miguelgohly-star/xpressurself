import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/messages/[friendId]/[messageId] — toggle heart reaction on a message
export async function PATCH(req: Request, { params }: { params: Promise<{ friendId: string; messageId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { friendId, messageId } = await params;
  const myId = session.user.id;

  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  const inConversation =
    (message.senderId === myId && message.receiverId === friendId) ||
    (message.senderId === friendId && message.receiverId === myId);
  if (!inConversation) return NextResponse.json({ error: "Not your conversation" }, { status: 403 });

  const { liked } = await req.json();
  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { liked: !!liked },
  });

  return NextResponse.json(updated);
}
