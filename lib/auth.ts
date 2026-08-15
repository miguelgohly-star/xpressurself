import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

const USERNAME_RE = /[^a-z0-9_]/g;

// OAuth sign-ups (Google) don't go through /api/register, so nothing
// sets the required, unique `username` field — the Prisma adapter's default
// createUser would violate that constraint. Derive one from the email's
// local part instead, deduping against collisions.
async function generateUsername(seed: string): Promise<string> {
  const base = seed.toLowerCase().replace(USERNAME_RE, "").slice(0, 20).padEnd(3, "0") || "user";
  let candidate = base;
  let suffix = 0;
  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    suffix++;
    const tail = String(suffix);
    candidate = `${base.slice(0, 20 - tail.length)}${tail}`;
  }
  return candidate;
}

const baseAdapter = PrismaAdapter(prisma);
const adapter: Adapter = {
  ...baseAdapter,
  async createUser(user) {
    const seed = user.email?.split("@")[0] ?? user.name ?? "user";
    const username = await generateUsername(seed);
    return baseAdapter.createUser!({ ...user, username } as any);
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter,
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET,
  pages: { signIn: "/auth" },
  providers: [
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({ where: { email: credentials.email as string } });
        if (!user?.password) return null;
        const valid = await bcrypt.compare(credentials.password as string, user.password);
        if (!valid) return null;
        // Return username + name (nickname) + image so they land in the token
        return { id: user.id, name: user.name, email: user.email, username: user.username, image: user.image } as any;
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [Google({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET })]
      : []),
  ],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.username = (user as any).username;
        if ((user as any).image) token.picture = (user as any).image;
      }
      // updateSession() calls come through here as trigger="update"
      if (trigger === "update" && session) {
        if (session.name !== undefined) token.name = session.name;
        if (session.image !== undefined) token.picture = session.image;
        if (session.username !== undefined) token.username = session.username;
      }
      return token;
    },
    session({ session, token }) {
      if (token?.id) session.user.id = token.id as string;
      if (token?.username) (session.user as any).username = token.username;
      if (token?.picture) session.user.image = token.picture as string;
      return session;
    },
  },
});
