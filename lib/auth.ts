import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
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
