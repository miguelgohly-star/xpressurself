import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get("avatar") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "Image must be under 4 MB" }, { status: 400 });

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const mime = MIME_BY_EXT[ext];
    if (!mime) return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });

    // Store the image inline in the database as a data URI — writing to local
    // disk doesn't survive redeploys/restarts on Railway's ephemeral filesystem.
    const bytes = await file.arrayBuffer();
    const imageUrl = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
    await prisma.user.update({ where: { id: session.user.id }, data: { image: imageUrl } });

    return NextResponse.json({ ok: true, image: imageUrl });
  } catch (err) {
    console.error("[avatar POST]", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
