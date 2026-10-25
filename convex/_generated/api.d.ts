/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as comments from "../comments.js";
import type * as communities from "../communities.js";
import type * as email from "../email.js";
import type * as feed from "../feed.js";
import type * as files from "../files.js";
import type * as follows from "../follows.js";
import type * as http from "../http.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_accounts from "../lib/accounts.js";
import type * as lib_cascade from "../lib/cascade.js";
import type * as lib_dto from "../lib/dto.js";
import type * as lib_notify from "../lib/notify.js";
import type * as lib_returns from "../lib/returns.js";
import type * as lib_signup from "../lib/signup.js";
import type * as lib_validate from "../lib/validate.js";
import type * as notifications from "../notifications.js";
import type * as posts from "../posts.js";
import type * as profiles from "../profiles.js";
import type * as reservations from "../reservations.js";
import type * as search from "../search.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  admin: typeof admin;
  auth: typeof auth;
  comments: typeof comments;
  communities: typeof communities;
  email: typeof email;
  feed: typeof feed;
  files: typeof files;
  follows: typeof follows;
  http: typeof http;
  "lib/access": typeof lib_access;
  "lib/accounts": typeof lib_accounts;
  "lib/cascade": typeof lib_cascade;
  "lib/dto": typeof lib_dto;
  "lib/notify": typeof lib_notify;
  "lib/returns": typeof lib_returns;
  "lib/signup": typeof lib_signup;
  "lib/validate": typeof lib_validate;
  notifications: typeof notifications;
  posts: typeof posts;
  profiles: typeof profiles;
  reservations: typeof reservations;
  search: typeof search;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("../betterAuth/_generated/component.js").ComponentApi<"betterAuth">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
};
