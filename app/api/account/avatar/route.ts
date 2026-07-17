import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile } from "fs/promises";
import path from "path";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get("avatar") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "Image must be under 4 MB" }, { status: 400 });

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    if (!["jpg", "jpeg", "png", "webp", "gif"].includes(ext))
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const filename = `${session.user.id}.${ext}`;
    const dest = path.join(process.cwd(), "public", "avatars", filename);
    await writeFile(dest, Buffer.from(bytes));

    const imageUrl = `/avatars/${filename}?t=${Date.now()}`;
    await prisma.user.update({ where: { id: session.user.id }, data: { image: imageUrl } });

    return NextResponse.json({ ok: true, image: imageUrl });
  } catch (err) {
    console.error("[avatar POST]", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
