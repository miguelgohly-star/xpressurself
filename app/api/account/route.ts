import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  try {
    const { username, nickname, bio, currentPassword, newPassword } = await req.json();
    const data: Record<string, any> = {};

    if (username !== undefined) {
      const trimmed = username.trim().toLowerCase();
      if (!USERNAME_RE.test(trimmed))
        return NextResponse.json({ error: "3–20 chars, lowercase letters, numbers, underscores only", field: "username" }, { status: 400 });
      const existing = await prisma.user.findUnique({ where: { username: trimmed } });
      if (existing && existing.id !== session.user.id)
        return NextResponse.json({ error: "That username is taken", field: "username" }, { status: 409 });
      data.username = trimmed;
    }

    if (nickname !== undefined) data.name = nickname?.trim() || null;
    if (bio !== undefined) data.bio = bio?.trim() || null;

    if (newPassword) {
      if (!currentPassword) return NextResponse.json({ error: "Current password required", field: "currentPassword" }, { status: 400 });
      if (newPassword.length < 6) return NextResponse.json({ error: "New password must be at least 6 characters", field: "newPassword" }, { status: 400 });
      const user = await prisma.user.findUnique({ where: { id: session.user.id } });
      if (!user?.password) return NextResponse.json({ error: "No password set on this account", field: "currentPassword" }, { status: 400 });
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) return NextResponse.json({ error: "Current password is incorrect", field: "currentPassword" }, { status: 400 });
      data.password = await bcrypt.hash(newPassword, 12);
    }

    const updated = await prisma.user.update({ where: { id: session.user.id }, data });
    return NextResponse.json({ ok: true, name: updated.name, bio: updated.bio, username: updated.username });
  } catch (err) {
    console.error("[account PATCH]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
