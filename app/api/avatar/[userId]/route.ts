import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/avatar/[userId] — serves the uploaded avatar bytes from the database.
// Kept as a separate lightweight endpoint so session/JWT cookies only ever carry
// this short URL, never the raw image data.
export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarData: true, avatarMime: true },
  });

  if (!user?.avatarData || !user.avatarMime) {
    return NextResponse.json({ error: "No avatar" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(user.avatarData), {
    headers: {
      "Content-Type": user.avatarMime,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
