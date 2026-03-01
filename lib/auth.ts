import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

// Convex HTTP helpers for server-side auth operations
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL!;

async function convexQuery(
  functionPath: string,
  args: Record<string, unknown>
) {
  const response = await fetch(`${CONVEX_URL}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: functionPath, args, format: "json" }),
  });
  const data = await response.json();
  return data.value;
}

async function convexMutation(
  functionPath: string,
  args: Record<string, unknown>
) {
  const response = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: functionPath, args, format: "json" }),
  });
  const data = await response.json();
  return data.value;
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: { prompt: "select_account" },
      },
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const user = await convexQuery("users:getUserWithPassword", {
          email: credentials.email,
        });

        if (!user) {
          throw new Error("No account found with this email");
        }

        if (!user.password) {
          throw new Error(
            "This account uses Google sign-in. Please use Google to log in."
          );
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.password
        );
        if (!isValid) {
          throw new Error("Invalid password");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        await convexMutation("users:saveUser", {
          name: user.name || "User",
          email: user.email!,
          image: user.image,
          provider: "google",
          providerId: account.providerAccountId,
        });
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub!;
        (session.user as any).role = token.role as string;
        (session.user as any).provider = token.provider as string;
      }
      return session;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.sub = (user as any).id;
        token.role = (user as any).role;
      }
      if (account) {
        token.provider = account.provider;
      }
      // Fetch role from Convex on first sign-in (for Google users)
      if (account?.provider === "google" && token.email) {
        const dbUser = await convexQuery("users:getUser", {
          email: token.email,
        });
        if (dbUser) {
          token.role = dbUser.role;
        }
      }
      return token;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
