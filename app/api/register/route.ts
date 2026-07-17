import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, nickname, email, password } = body;

    if (!username?.trim()) return NextResponse.json({ error: "Username required", field: "username" }, { status: 400 });
    if (!USERNAME_RE.test(username.trim())) return NextResponse.json({ error: "3–20 chars, lowercase letters, numbers, underscores only", field: "username" }, { status: 400 });
    if (!email?.trim()) return NextResponse.json({ error: "Email required", field: "email" }, { status: 400 });
    if (!password || password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters", field: "password" }, { status: 400 });

    const [existingEmail, existingUsername] = await Promise.all([
      prisma.user.findUnique({ where: { email: email.trim() } }),
      prisma.user.findUnique({ where: { username: username.trim() } }),
    ]);
    if (existingEmail) return NextResponse.json({ error: "An account with that email already exists", field: "email" }, { status: 409 });
    if (existingUsername) return NextResponse.json({ error: "That username is taken", field: "username" }, { status: 409 });

    const hashed = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        username: username.trim(),
        name: nickname?.trim() || null,
        email: email.trim(),
        password: hashed,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[register]", err);
    return NextResponse.json({ error: "Something went wrong on our end. Please try again." }, { status: 500 });
  }
}
