import { createClient, type AuthFunctions, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { requireActionCtx } from "@convex-dev/better-auth/utils";
import { passkey } from "@better-auth/passkey";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { v } from "convex/values";
import authSchema from "./betterAuth/schema";
import authConfig from "./auth.config";
import { sendEmailVerification, sendResetPassword } from "./email";
import { createProfileForAuthUser, deleteAllDataForAuthUser } from "./lib/accounts";
import { parseSignupMeta } from "./lib/signup";
import { passwordSchema, usernameSchema } from "../lib/validators/auth";

const siteUrl = process.env.SITE_URL!;

/**
 * The Better Auth component client. Triggers keep Mazi's app data in step with
 * the auth user: a profile (+ reservation) is created in the same transaction
 * as the user, and deleting the user erases everything they own.
 */
// Explicitly typed to break the type cycle through `internal.auth`.
const authFunctions: AuthFunctions = internal.auth;

export const authComponent = createClient<DataModel, typeof authSchema>(
  components.betterAuth,
  {
    local: { schema: authSchema },
    authFunctions,
    triggers: {
      user: {
        onCreate: async (ctx, user) => {
          await createProfileForAuthUser(ctx, user);
        },
        onDelete: async (ctx, user) => {
          await deleteAllDataForAuthUser(ctx, user._id);
        },
      },
    },
  }
);

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

/**
 * Google / Apple are wired but only switch on once their credentials exist on
 * the deployment (GOOGLE_CLIENT_ID/SECRET, APPLE_CLIENT_ID/SECRET). The login
 * UI asks `auth:providers` which ones to show.
 */
function enabledSocialProviders(): BetterAuthOptions["socialProviders"] {
  const providers: NonNullable<BetterAuthOptions["socialProviders"]> = {};
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.google = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      prompt: "select_account",
    };
  }
  if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
    providers.apple = {
      clientId: process.env.APPLE_CLIENT_ID,
      clientSecret: process.env.APPLE_CLIENT_SECRET,
      appBundleIdentifier: process.env.APPLE_APP_BUNDLE_IDENTIFIER,
    };
  }
  return providers;
}

function firstIssue(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues[0]?.message ?? "Invalid input";
}

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  const social = enabledSocialProviders();
  return {
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    trustedOrigins: [
      siteUrl,
      ...(social?.apple ? ["https://appleid.apple.com"] : []),
    ].filter(Boolean),
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmailVerification(requireActionCtx(ctx), { to: user.email, url });
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendResetPassword(requireActionCtx(ctx), { to: user.email, url });
      },
    },
    socialProviders: social,
    account: {
      accountLinking: { enabled: true, trustedProviders: ["google", "apple"] },
    },
    user: {
      additionalFields: {
        // JSON of the signup form's extra fields (username + reservation
        // survey). Read once by the onCreate trigger; never trusted for the
        // access tier, which comes from appConfig.
        signupMeta: { type: "string", required: false, input: true },
      },
      deleteUser: { enabled: true },
    },
    // Backed by the component's rateLimit table so limits hold across Convex's
    // stateless function instances. Covers the public signup/reserve path.
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-up/email": { window: 60 * 60, max: 10 },
        "/sign-in/email": { window: 60, max: 10 },
        "/request-password-reset": { window: 60 * 60, max: 5 },
        "/send-verification-email": { window: 60 * 60, max: 5 },
      },
    },
    hooks: {
      // Mirror the app's account rules (lib/validators/auth) at the auth API,
      // which is the real boundary — the forms' client checks are UX only.
      before: createAuthMiddleware(async (mw) => {
        if (mw.path === "/sign-up/email") {
          const pw = passwordSchema.safeParse(mw.body?.password);
          if (!pw.success) {
            throw new APIError("BAD_REQUEST", { message: firstIssue(pw) });
          }
          const meta = parseSignupMeta(mw.body?.signupMeta);
          const name = usernameSchema.safeParse(meta.username);
          if (!name.success) {
            throw new APIError("BAD_REQUEST", { message: firstIssue(name) });
          }
          if ("runQuery" in ctx) {
            const taken = await ctx.runQuery(internal.profiles.isUsernameTaken, {
              username: name.data,
            });
            if (taken) {
              throw new APIError("BAD_REQUEST", {
                message: "That username is already taken. Try another.",
              });
            }
          }
        }
        if (mw.path === "/reset-password") {
          const pw = passwordSchema.safeParse(mw.body?.newPassword);
          if (!pw.success) {
            throw new APIError("BAD_REQUEST", { message: firstIssue(pw) });
          }
        }
      }),
    },
    plugins: [
      passkey({
        rpID: siteUrl ? new URL(siteUrl).hostname : undefined,
        rpName: "Mazi",
        origin: siteUrl,
      }),
      convex({ authConfig }),
    ],
  } satisfies BetterAuthOptions;
};

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth(createAuthOptions(ctx));

/** Which OAuth buttons the sign-in UI should render. Public, booleans only. */
export const providers = query({
  args: {},
  returns: v.object({ google: v.boolean(), apple: v.boolean() }),
  handler: async () => {
    const social = enabledSocialProviders() ?? {};
    return { google: !!social.google, apple: !!social.apple };
  },
});

/** The signed-in auth user's email (for Settings). */
export const myEmail = query({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    return user?.email ?? null;
  },
});
