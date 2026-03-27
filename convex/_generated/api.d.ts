/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as bookmarks from "../bookmarks.js";
import type * as botOnboarding from "../botOnboarding.js";
import type * as http from "../http.js";
import type * as lib_cors from "../lib/cors.js";
import type * as messages from "../messages.js";
import type * as migrations from "../migrations.js";
import type * as pushSubscriptions from "../pushSubscriptions.js";
import type * as quiz from "../quiz.js";
import type * as quizCore from "../quizCore.js";
import type * as reviewCards from "../reviewCards.js";
import type * as threads from "../threads.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  bookmarks: typeof bookmarks;
  botOnboarding: typeof botOnboarding;
  http: typeof http;
  "lib/cors": typeof lib_cors;
  messages: typeof messages;
  migrations: typeof migrations;
  pushSubscriptions: typeof pushSubscriptions;
  quiz: typeof quiz;
  quizCore: typeof quizCore;
  reviewCards: typeof reviewCards;
  threads: typeof threads;
  users: typeof users;
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

export declare const components: {};
