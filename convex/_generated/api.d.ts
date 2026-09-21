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
import type * as actionItems from "../actionItems.js";
import type * as activity from "../activity.js";
import type * as activityActions from "../activityActions.js";
import type * as activityMedia from "../activityMedia.js";
import type * as activityMediaActions from "../activityMediaActions.js";
import type * as billActions from "../billActions.js";
import type * as bills from "../bills.js";
import type * as comments from "../comments.js";
import type * as computeAnalytics from "../computeAnalytics.js";
import type * as crons from "../crons.js";
import type * as decisions from "../decisions.js";
import type * as documentExtraction from "../documentExtraction.js";
import type * as documentExtractionHelpers from "../documentExtractionHelpers.js";
import type * as documentStorage from "../documentStorage.js";
import type * as documentStorageHelpers from "../documentStorageHelpers.js";
import type * as featuredVideos from "../featuredVideos.js";
import type * as fields from "../fields.js";
import type * as images from "../images.js";
import type * as legislativeActions from "../legislativeActions.js";
import type * as legislativeFeed from "../legislativeFeed.js";
import type * as legislativeRefresh from "../legislativeRefresh.js";
import type * as mediaSources from "../mediaSources.js";
import type * as migrations from "../migrations.js";
import type * as multiplayerSchema from "../multiplayerSchema.js";
import type * as parties from "../parties.js";
import type * as politicianFacts from "../politicianFacts.js";
import type * as politicians from "../politicians.js";
import type * as presence from "../presence.js";
import type * as seed from "../seed.js";
import type * as sessions from "../sessions.js";
import type * as sourceRegistry from "../sourceRegistry.js";
import type * as stickyNotes from "../stickyNotes.js";
import type * as storage from "../storage.js";
import type * as transparency from "../transparency.js";
import type * as userPreferences from "../userPreferences.js";
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
  actionItems: typeof actionItems;
  activity: typeof activity;
  activityActions: typeof activityActions;
  activityMedia: typeof activityMedia;
  activityMediaActions: typeof activityMediaActions;
  billActions: typeof billActions;
  bills: typeof bills;
  comments: typeof comments;
  computeAnalytics: typeof computeAnalytics;
  crons: typeof crons;
  decisions: typeof decisions;
  documentExtraction: typeof documentExtraction;
  documentExtractionHelpers: typeof documentExtractionHelpers;
  documentStorage: typeof documentStorage;
  documentStorageHelpers: typeof documentStorageHelpers;
  featuredVideos: typeof featuredVideos;
  fields: typeof fields;
  images: typeof images;
  legislativeActions: typeof legislativeActions;
  legislativeFeed: typeof legislativeFeed;
  legislativeRefresh: typeof legislativeRefresh;
  mediaSources: typeof mediaSources;
  migrations: typeof migrations;
  multiplayerSchema: typeof multiplayerSchema;
  parties: typeof parties;
  politicianFacts: typeof politicianFacts;
  politicians: typeof politicians;
  presence: typeof presence;
  seed: typeof seed;
  sessions: typeof sessions;
  sourceRegistry: typeof sourceRegistry;
  stickyNotes: typeof stickyNotes;
  storage: typeof storage;
  transparency: typeof transparency;
  userPreferences: typeof userPreferences;
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
