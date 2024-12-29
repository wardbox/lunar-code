import NextAuth, { AuthOptions } from "next-auth"
import GitHub from "next-auth/providers/github"
import { JWT } from "next-auth/jwt"
import { Session } from "next-auth"
import prisma from '@/lib/prisma'

// Extend the built-in types
declare module "next-auth" {
  interface Session {
    accessToken?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string
  }
}

export const authOptions: AuthOptions = {
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
      authorization: {
        params: {
          scope: "read:user user:email repo",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
      }
      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken
      return session
    },
  },
  events: {
    async signIn({ user, account, profile }) {
      console.log('Sign in event:', { 
        user: { id: user.id, email: user.email },
        profile: { login: (profile as any).login }
      });

      if (account?.provider === 'github') {
        // Update or create user with GitHub info
        await prisma.user.upsert({
          where: { email: user.email! },
          update: {
            name: (profile as any).login,
            image: user.image,
            accounts: {
              upsert: {
                where: {
                  provider_providerAccountId: {
                    provider: account.provider,
                    providerAccountId: account.providerAccountId,
                  },
                },
                create: {
                  type: account.type,
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                  access_token: account.access_token,
                  token_type: account.token_type,
                  scope: account.scope,
                },
                update: {
                  access_token: account.access_token,
                  token_type: account.token_type,
                  scope: account.scope,
                },
              },
            },
          },
          create: {
            email: user.email!,
            name: (profile as any).login,
            image: user.image,
            accounts: {
              create: {
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                token_type: account.token_type,
                scope: account.scope,
              },
            },
          },
        });
      }
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  cookies: {
    state: {
      name: 'next-auth.state',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      }
    }
  }
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST } 
