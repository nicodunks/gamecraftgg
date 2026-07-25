import { betterAuth } from 'better-auth';
import { db } from './db';
import { grantSignupCredits } from './credits';
import { randomGamertag } from './names';

// Every player gets a generated gamertag at signup (DoodleFox42) — it's their
// public identity on /u/<tag> and the leaderboards; emails stay private.
function uniqueGamertag(): string {
  for (let i = 0; i < 8; i++) {
    const tag = randomGamertag();
    const hit = db().prepare('SELECT 1 FROM user WHERE name = ?').get(tag);
    if (!hit) return tag;
  }
  return `Player${Date.now().toString(36).slice(-6)}`; // astronomically unlikely
}

// Email + password only, by design: no OAuth console to configure, no email
// service to stand up (launch stack is one box + Polar). Better Auth owns the
// user/session/account/verification tables in the same SQLite file as the
// product data — one file to back up, one transaction domain.
export const auth = betterAuth({
  database: db(),
  secret: process.env.BETTER_AUTH_SECRET,
  // canonical origin comes from BETTER_AUTH_URL; these extras keep sign-in
  // working from www and the fly.dev fallback hostname
  trustedOrigins: ['https://www.gamecraft.gg', 'https://gamecraft.fly.dev'],
  // Free credits are sellable inventory (200cr = $20 of generation per account)
  // and email is unverified, so account farming is the #1 abuse vector. Per-IP
  // signup throttling is the launch-day defense; email verification is the
  // scheduled follow-up once an email service exists.
  // Fly terminates TLS and forwards the real client IP in Fly-Client-IP.
  // Without this, Better Auth can't attribute requests and collapses rate
  // limiting into ONE shared bucket — 5 signups TOTAL per hour, site-wide.
  advanced: {
    ipAddress: {
      ipAddressHeaders: ['fly-client-ip', 'x-forwarded-for'],
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
    customRules: {
      '/sign-up/email': { window: 3600, max: 5 },
      '/sign-in/email': { window: 600, max: 10 },
    },
  },
  emailAndPassword: {
    enabled: true,
    // No email service at launch (deliberate) — so no verification mail and no
    // reset-password flow. Abuse pressure is handled by per-IP limits instead
    // (PLAN.md "free credits are inventory").
    requireEmailVerification: false,
  },
  // Google sign-in: free, Google-verified emails (farming needs real Google
  // accounts), and no CSP loosening — it's a pure redirect flow. Configured
  // only when the secrets exist, so dev/prod without them still boots and the
  // login page hides the button (it asks /api/auth-config at runtime).
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        socialProviders: {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            // multi-account users should get the chooser, not a silent default
            prompt: 'select_account' as const,
          },
        },
      }
    : {}),
  account: {
    accountLinking: {
      enabled: true,
      // Same inbox, one account: a password user who later clicks Google gets
      // linked, not duplicated (no second signup grant). Google is safe to
      // trust for this because it only asserts verified emails.
      trustedProviders: ['google'],
      // We ship NO email-verification flow, so every credential account is
      // emailVerified=0 forever. Better Auth's default (true) therefore
      // refuses to link Google to ANY existing password account — that is
      // literally the `account_not_linked` error every early user would hit.
      // Google's assertion is the strongest verification we have; requiring a
      // local verification we never perform would gate linking on something
      // that can never become true.
      requireLocalEmailVerified: false,
    },
  },
  databaseHooks: {
    user: {
      create: {
        // gamertag replaces whatever name the signup form supplied
        before: async (user) => ({ data: { ...user, name: uniqueGamertag() } }),
        // The signup grant rides the user-creation hook; addEntry is idempotent
        // on (signup_grant, userId) so a re-fired hook can't double-grant.
        after: async (user) => {
          grantSignupCredits(user.id);
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
