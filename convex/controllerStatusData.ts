import {v} from 'convex/values';
export const statusFields={
 observedAt:v.number(),state:v.string(),reason:v.string(),scopeLabel:v.string(),scopeItemKeys:v.array(v.string()),
 allocation:v.object({startedAt:v.number(),endsAt:v.number(),limitPoints:v.number(),reservePoints:v.number()}),
 providers:v.array(v.object({provider:v.union(v.literal('codex'),v.literal('claude')),limitPoints:v.optional(v.number()),observedAt:v.number(),meterState:v.string(),reason:v.string(),weekly:v.array(v.object({id:v.string(),baselinePercent:v.number(),usedPercent:v.number(),deltaPoints:v.number(),remainingPoints:v.number(),resetsAt:v.number()}))})),
 runs:v.object({total:v.number(),codex:v.number(),claude:v.number(),reportedTokens:v.number(),knownFreshTokens:v.number(),unknownFinalRuns:v.number()}),
};
