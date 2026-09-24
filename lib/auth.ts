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
        email: { label: "Name or email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const input = credentials.email.trim().toLowerCase();
        const aliases: Record<string,string> = {
          eric: 'eric@quexopa.io',
          jose: 'jose@quexopa.io',
          admin: 'admin@orwell.com',
        };
        const aliasEmail = aliases[input];
        const user = await convexQuery("users:getUserWithPassword", {
          email: aliasEmail ?? input,
        });

        if (!user) {
          throw new Error("No account found with this email");
        }

        if (!user.password) {
          throw new Error(
            "This account uses Google sign-in. Please use Google to log in."
          );
        }

        const shortcutHashes = aliasEmail && user.email?.toLowerCase() === aliasEmail
          ? [process.env.SHORT_LOGIN_QUEXOPA_HASH, process.env.SHORT_LOGIN_PANAMA_HASH].filter((hash): hash is string => !!hash)
          : [];
        const shortcutMatches = await Promise.all(shortcutHashes.map(hash => bcrypt.compare(credentials.password, hash)));
        const isValid = shortcutMatches.some(Boolean) || await bcrypt.compare(credentials.password, user.password);
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
        if(!user.email)return false;
        const existing=await convexQuery("users:getUser",{email:user.email});
        if(!existing)return false;
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user) {
        const sessionUser=session.user as typeof session.user & {id?:string;role?:string;provider?:string};
        sessionUser.id = token.sub!;
        sessionUser.role = token.role as string;
        sessionUser.provider = token.provider as string;
      }
      return session;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.sub = (user as typeof user & {id?:string}).id;
        token.role = (user as typeof user & {role?:string}).role;
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
