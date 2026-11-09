import NextAuth, { type NextAuthConfig } from "next-auth";
import Apple from "next-auth/providers/apple";
import Google from "next-auth/providers/google";
import { appleClientSecret, appleKeyConfigured } from "@/lib/identity";

/** Sign in with Apple on the web needs a Services ID plus a signing key (or a pre-generated client secret). */
export const appleWebEnabled = () => !!process.env.AUTH_APPLE_ID && (appleKeyConfigured() || !!process.env.AUTH_APPLE_SECRET);

// Apple posts the sign-in result back to us cross-site (response_mode=form_post), so the one-time
// check cookies must be SameSite=None to arrive with it. Apple only works over HTTPS, so they're Secure.
const crossSite = (name: string, maxAge?: number) => ({
  name: `__Secure-authjs.${name}`,
  options: { httpOnly: true, sameSite: "none" as const, path: "/", secure: true, ...(maxAge ? { maxAge } : {}) },
});

export const { handlers, auth, signIn, signOut } = NextAuth(async (): Promise<NextAuthConfig> => {
  const apple = appleWebEnabled();
  return {
    providers: [
      Google,
      ...(apple ? [Apple({ clientId: process.env.AUTH_APPLE_ID, clientSecret: (await appleClientSecret(process.env.AUTH_APPLE_ID!)) ?? undefined })] : []),
    ],
    session: { strategy: "jwt" },
    trustHost: true,
    pages: { signIn: "/", error: "/" },
    cookies: apple
      ? {
          state: crossSite("state", 900),
          nonce: crossSite("nonce"),
          pkceCodeVerifier: crossSite("pkce.code_verifier", 900),
          callbackUrl: crossSite("callback-url"),
        }
      : undefined,
    callbacks: {
      jwt({ token, account }) {
        // Stable per-user key: the provider's account ID (`sub`), not the random ID Auth.js generates without an adapter.
        if (account) token.uid = `${account.provider}:${account.providerAccountId}`;
        // Kept (encrypted, in the session cookie) so deleting the account can revoke Apple's token.
        if (account?.provider === "apple" && account.refresh_token) token.appleRefreshToken = account.refresh_token;
        return token;
      },
      session({ session, token }) {
        if (typeof token.uid === "string") session.user.id = token.uid;
        return session;
      },
    },
  };
});
