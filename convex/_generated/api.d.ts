/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accounts from "../accounts.js";
import type * as computeAnalytics from "../computeAnalytics.js";
import type * as featuredVideos from "../featuredVideos.js";
import type * as mediaSources from "../mediaSources.js";
import type * as parties from "../parties.js";
import type * as politicians from "../politicians.js";
import type * as seed from "../seed.js";
import type * as storage from "../storage.js";
import type * as transparency from "../transparency.js";
import type * as users from "../users.js";
import type * as voting from "../voting.js";
import type * as votingIngestion from "../votingIngestion.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accounts: typeof accounts;
  computeAnalytics: typeof computeAnalytics;
  featuredVideos: typeof featuredVideos;
  mediaSources: typeof mediaSources;
  parties: typeof parties;
  politicians: typeof politicians;
  seed: typeof seed;
  storage: typeof storage;
  transparency: typeof transparency;
  users: typeof users;
  voting: typeof voting;
  votingIngestion: typeof votingIngestion;
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
