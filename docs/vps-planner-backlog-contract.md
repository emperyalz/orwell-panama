# VPS product planner contract

The planner proposes useful work from the current public scoreboard and dispatch snapshot. It never writes scope, changes a task, chooses a command, raises a budget, deploys, or approves its own work. The original 30-point subscription allocation, reserve, deadline and provider-independent QA remain controller policy. Provider swaps and reversible runtime repairs remain trusted controller decisions.

`validatePlan({plan,backlog,policy,existingPaths,verifiedAssetPaths,now})` returns `{allowed:true,plan}` or `{allowed:false,reason}`. `backlog` accepts a flat step array, a scoreboard task array, or `{scoreboard,dispatch:{items}}`. Checked scoreboard rows remain checked even if a stale dispatch row says ready. Only the ten existing product families qualify. An optional trusted `policy.itemKeys` narrows these keys. The function does not mutate inputs.

The exact proposal shape is:

```json
{
  "tasks": [{
    "itemKey": "communication-trends/document-analysis-methods",
    "wholeStep": true,
    "acceptance": "Document all implemented archive calculations, their units, source rules and coverage limitations with exact code references.",
    "allowedPaths": ["docs/product-audits/communication-methods.md"],
    "verification": {"kind": "source-audit"},
    "delivery": "evidence",
    "modelTier": "economy",
    "reason": "The complete implemented method is inspectable in two source files and needs no collection or schema migration.",
    "dependencies": []
  }],
  "blocked": [],
  "summary": "Document the implemented archive method and its interpretive limits."
}
```

Select one or two existing unchecked keys. Declare whole-step acceptance and all known dependencies. A dependency must already be checked or occur earlier in the same proposed batch. Active leases, pending retries and review/acceptance phases cannot be reassigned as new worker runs. A plan with no work must explain every remaining authorized open key. Blocking proposals are local planning explanations, never automatic task-state writes.

Permitted exact files are TypeScript product source under `convex/` (excluding generated code), ordinary JavaScript/TypeScript/CSS/JSON/SVG source under `src/`, new or existing files under `scripts/product-audits/` and `docs/product-audits/`, and existing public assets explicitly approved by the trusted `verifiedAssetPaths` inventory. New exact product files are allowed so the planner can propose real feature development. Generate `existingPaths` from the root-owned source manifest, which rejects symlinks; public assets must occur in both trusted inventories. Whole-directory scopes, traversal, hidden paths, controller files, credentials and provider/policy configuration are refused. No arbitrary command, shell, provider, budget, deletion or new-key fields are accepted. Evidence-only tasks cannot edit application source.

Verification kinds are `inventory`, `source-research`, `source-audit`, `frontend-contract`, `backend-contract`, `fullstack-contract`, and `language-contract`. Root must map each selected kind and exact item key to a meaningful fixed verifier before activating the proposal. A kind is not an executable command or proof. Reject unsupported mappings. Run trusted checks with the unprivileged runner, retain output, and obtain independent provider QA on the exact immutable revision. Backend/frontend changes also need their real deployment and post-deployment checks. Evidence tasks need source-backed artifacts and reproducible checks, not a deployment invented to satisfy an unrelated infrastructure gate.

`wholeStep:true` is a required assertion, not evidence of completeness. Root and independent QA compare acceptance against the existing checklist meaning. A three-person sample cannot finish a 91-person audit; six accepted career profiles cannot finish every politician's earlier-office history. If an existing step is too large for the bounded execution window, propose it blocked with the exact decomposition needed and select another deliverable key. Only root can create truthful child steps. Do not generate invented child keys and do not mark the broader parent complete for partial work. Root's source-diff gate must also prohibit deleting existing files; the proposal schema has no deletion authorization.

## Observed remaining work and next choices

Public production queries during this investigation returned 42 open product steps across the ten families. `profile-facts-audit/directory`, `social-identity-audit/missing`, and `communication-trends/show-dated-supporting-posts` are now checked; do not dispatch their old research scopes again. Earlier research notes and the Knowledge career reference decision remain useful context, but production is the current completion source.

1. `communication-trends/document-analysis-methods`: inspect `convex/intelligence.ts`, `src/components/reference/IntelligenceWorkspace.tsx`, and the accepted evidence-filter audit. Produce a complete method document and a deterministic source-contract verifier under the two product-audit directories. Cover archive row counts, month boundaries/timezones, filters, format precedence, exact-account versus person/platform grouping, examples, and import-check versus publication dates. State that counts do not measure opinion, ideology or total platform output. Existing source makes this a complete bounded documentation step. No research access or frontend deployment is required. Use `source-audit`, `delivery:evidence`, economy tier.

2. `communication-trends/label-uncertainty-and-archive-gaps`: inspect the current chart, table, coverage note and account labels before editing. Identify every visible zero/empty-month presentation and label it as observed archive coverage rather than platform inactivity. Preserve exact-account versus person/platform scope and original publication versus import times. A full bounded implementation can cover this one intelligence workspace across ES/EN/PT with focused fixtures for zero buckets, absent rows and filtered periods. Exact candidate files: `src/components/reference/IntelligenceWorkspace.tsx`, `src/components/reference/intelligence.css`, plus a targeted verifier/audit under the two audit directories. Add `convex/intelligence.ts` only if source inspection establishes a missing distinction that the UI cannot derive. Use `frontend-contract`, `delivery:frontend`, economy tier; deploy and independently verify the real `/inteligencia` page before completing it. If the existing page already meets the requirement, deliver a whole-step evidence audit instead of gratuitous UI changes.

Known source-access limits: earlier Instagram/TikTok/X retrieval was throttled or denied. Institutional Assembly, Presidency, municipal, party, owner-site and Gaceta sources are productive research routes. A failed public-profile fetch is unresolved evidence, never an instruction to lower scraping cadence, transfer legacy avatars/posts, invent ownership or consume paid collection.
