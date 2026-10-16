# Orwell Paperclip bridge

Paperclip schedules actual product checklist phases. Convex remains authoritative for
queue, acceptance and original checkboxes. This bridge never writes Convex, launches
a model CLI, reads provider authentication, or changes the controller's allocation.
Only `orwell-agent-controller.service` starts native subscription models and performs
independent QA, deterministic acceptance and deployment.

## Files and ownership

Install `bridge.py` and `client.py` root-owned under `/opt/orwell-paperclip/`.
Run the bridge as root, with `/var/lib/orwell-paperclip/` private to root (0700).
Run Paperclip as its separate unprivileged UID. Model user `orwell` must not belong
to the `paperclip` group. The bridge creates
`/run/orwell-paperclip/control.sock` root:paperclip 0660. It checks Linux
`SO_PEERCRED` and permits only root or the configured Paperclip UID.

Root configuration `/etc/orwell-paperclip/bridge.json`:

```json
{
  "paperclipUrl": "http://127.0.0.1:3100",
  "companyId": "REPLACE-WITH-COMPANY-UUID",
  "agents": {
    "codex": "REPLACE-WITH-CODEX-UUID",
    "claude": "REPLACE-WITH-CLAUDE-UUID",
    "orion": "REPLACE-WITH-ORION-UUID",
    "planner": "OPTIONAL-PLANNER-AGENT-UUID"
  },
  "paperclipUid": 995,
  "paperclipGid": 986,
  "controllerStateDirectory": "/var/lib/orwell-agent-controller",
  "scope": {"itemKeys": ["profile-facts-audit/directory", "social-identity-audit/missing"]},
  "priorityItemKeys": ["profile-facts-audit/directory", "social-identity-audit/missing"],
  "enableWakeups": false,
  "providerRouting": true,
  "followControllerScope": true,
  "enablePlanningWakeups": false,
  "maxPlansPerDay": 24,
  "assignAgents": false,
  "boardUserId": "local-board"
}
```

Optional paths: `stateDirectory`, `socketPath`, `scopePath`, `policyPath`,
`usagePath`, `routingPath`, `plannerPath`. Defaults use the directories above and
the controller's existing `scope.json`, `policy.json`, `usage.json`, `routing.json`
and `planner.json`. No credentials belong in this file. Omit the planner agent
entry when planning is disabled. With `followControllerScope:false`, scope is
intersected with configured item keys. With it enabled, the root controller's live
scope governs new planned batches and must explicitly have `serverPlanning:true`.
Bridge config
and controller scope/policy must be root-owned regular files without group/other
write permission. The bridge only reads policy. Original 30-point allocation,
three-point reserve, baseline and original deadline stay under the controller.

Process adapter configuration for each agent:

```json
{
  "adapterType": "process",
  "adapterConfig": {
    "command": "/usr/bin/python3",
    "args": ["/opt/orwell-paperclip/client.py", "--role", "codex"],
    "cwd": "/opt/orwell-paperclip",
    "timeoutSec": 820,
    "graceSec": 15
  }
}
```

Use `claude`, `orion` and optional `planner` for the other agents. These are process
proxies: provider pool roles can perform implementation or independent QA according
to the root routing decision. No provider key, CLI auth directory,
or model user's home is needed. Paperclip's own injected run token is never read
or sent by the client. The client reads `PAPERCLIP_ISSUE_ID` or `PAPERCLIP_TASK_ID`
if available. The pinned generic process adapter does not inject them, so the
bridge resolves its role against the most recent persisted explicit wake, then
deterministically selects an eligible role step if no wake is pending.

## Bootstrap and runtime contract

1. Create the company and required process agents paused. Disable timers, enable
   on-demand wakes, and keep `assignAgents:false`. Pinned Paperclip does not honor
   separate assignment/comment suppression flags. Assign mirrored issues to board
   user `local-board` (or configured `boardUserId`), with no agent assignee. This
   provides the owner required for `in_progress` and prevents implicit agent wakes.
   Actual phase owners appear in issue descriptions.
2. Save agent UUIDs in the private bridge config. Start the bridge with wakeups
   disabled, or run `bridge.py --sync-once --no-wake` to import product issues.
3. Review imported inventory, source mapping and historical completed work.
   Set `enableWakeups: true` and resume the agents. Enable optional planner wakes
   only after the root planning authorization and scheduler exist. The root's
   read-only timer may refresh native quota and routing; only explicit bridge
   requests authorize execution. Only explicit bridge wakes schedule adapters.
4. Run `bridge.py --config /etc/orwell-paperclip/bridge.json` as a restartable root
   service. It polls the public Convex query endpoint every 20 seconds, even when
   there is no eligible work. Idle sync performs no inference.

The bridge imports product checklist steps and excludes agent, control-plane,
avatar and pilot tasks. Completed product history is preserved; `done` requires
both a Convex dispatch `accepted` state and the original checkbox `done: true`
for dispatched work. Older completed checkboxes without any dispatch record retain
their original `done` history and are labeled "Historical recorded completion, no
new controller acceptance." A mismatch between existing dispatch and checkbox
facts remains blocked for reconciliation. Out-of-scope open
product steps remain `backlog`. Either native provider may own work; independent
QA normally uses the opposite provider from the actual recorded author. The
root-authorized `claude-cross-model` mode below permits separate Sonnet/Opus
sessions within Claude. Triage and
final acceptance belong to Orion. Issue descriptions and explicit wake targets reflect
these real owners. Issues remain assigned to the board user to satisfy Paperclip's
active-state ownership requirement while suppressing implicit agent wakes from
board comments. State/description patches occur only on changes. `assignAgents:true`
is reserved for a future version with verified implicit-wake suppression.

Blocked mirrors include a board-owned `unblockDescriptor` containing the real
Convex next action or blocker. Paperclip rejects a transition to `blocked` without
an unresolved dependency/interaction or this descriptor (HTTP422). Reopening the
Convex step clears the descriptor in the same status update. This records who must
resolve the source blocker; it does not authorize inference or checklist changes.

The root-only mapping is atomic `/var/lib/orwell-paperclip/mapping.json`. Stable
source markers and create idempotency keys recover create-before-save crashes.
Real Convex events become bounded comments with content hashes, a saved dedup
cursor and deterministic UUID comment request IDs. No synthetic activity is added.
Comments also check remote markers after a restart to recover POST-before-save.

Explicit wake requests use the verified pinned API:

```text
POST /api/agents/{agentId}/wakeup
{"source":"automation","triggerDetail":"system","reason":"orwell_phase_ready",
 "payload":{"orwellIssueId":"...","orwellItemKey":"task/step"},
 "idempotencyKey":"orwell:<observed-phase-hash>"}
```

Only one phase-ready item can wake per poll; any unchanged pending explicit wake
blocks further wakes until dispatched or the actual queue state changes.
`priorityItemKeys` order precedes task order and defaults to configured scope order.
The item must be in both scopes, unchecked,
due for retry, free of any active queue lease and consistent with workspace
affinity. The original deadline must be open. In dynamic routing mode, the root's
fresh allowed route owns phase-specific admission, including global pause checks
and independent-review reserve. An exhausted author provider cannot block its
admitted opposite provider from reviewing already submitted work. Legacy mode
(`providerRouting:false`) preserves the prior both-provider admission and health
checks. The controller re-reads native meters before/during actual models; the
bridge never makes a provider quota choice or authorizes spending independently.

An attempted wake is persisted before its HTTP request. The same unchanged phase
is never automatically retried after a skipped/uncertain wake, service hold or
restart. Root may deliberately remove that item's `wakes` entry after resolving
the underlying problem. A genuine queue phase/retry/attempt transition generates
a new wake identity. A material root-selected provider change also changes the
wake identity. Observation timestamps alone do not. This avoids infinite retries.

## Root routing and server planning

With `providerRouting:true`, root-owned `routing.json` must be observed within
120 seconds (future skew <=5 seconds) and contain:

```json
{
  "observedAt": 0,
  "items": {
    "task/step": {"phase":"work","role":"claude","allowed":true,"reason":"Observed admission"}
  },
  "planner": {"allowed":true,"role":"codex","reason":"Observed planning admission"}
}
```

The controller can include other private routing fields; the bridge never exposes
them. Work/QA rows select either provider, triage/accept rows select Orion. Running
rows identify the actual active provider, without rebalancing an executing run.
Missing, stale, denied or phase-mismatched rows prevent execution. QA also requires
the public item `workerProvider` and rejects a same-provider review. Root's
read-only scheduler must refresh quota/routing before wake eligibility, including
while idle; polling this bridge does not call a native meter or model itself.

The narrow exception requires live root `scope.reviewMode:"claude-cross-model"`.
Only Claude can use it. The actual author profile must be known Sonnet or Opus;
the fresh QA route's `model` must name the opposite profile. When root omits that
model, the opposite canonical profile is deterministic. Unknown or identical
profiles remain held. A Codex quota hold does not prevent an admitted Claude
route. This does not permit same-provider Codex review.

Convex persists `workerModel` and `qaModel` from the actual observed
`projectAgents` session records, never from claimed model arguments, and exposes
them through snapshots/claims. Internal `dispatch:finish` accepts optional
`reviewMode:"claude-cross-model"`; root must pass that authorization for QA and
final acceptance. Both stages check distinct bound author/reviewer sessions and
canonical Sonnet/Opus models against their recorded values. Existing reviewer
identity, fresh QA binding, exact submitted revision, usage and deterministic
acceptance requirements remain in force. Full native IDs such as
`claude-sonnet-4-6` canonicalize strictly; ambiguous model strings fail closed.

Optional planning requires `agents.planner`, `enablePlanningWakeups:true`, live
`scope.serverPlanning:true`, and root-owned `planner.json`:

```json
{
  "state":"ready",
  "planningAllowed":true,
  "nextPlanAt":0,
  "lastPlanAt":0,
  "lastBacklogHash":"previous-material-backlog-hash",
  "backlogHash":"current-material-backlog-hash",
  "planCount":0
}
```

The planner cannot wake while a product phase is eligible or any lease is active.
It needs a fresh admitted `routing.planner` provider and the original allocation
window. Root remains responsible for actual pause/budget checks, bounded planning,
strict plan-contract validation and writing a new product batch. Actual product
implementation still requires independent QA under the authorized review mode and root acceptance;
planning proposals do not incur a separate model review turn.
The bridge writes no scope or task facts.

A changed backlog hash may bypass the minimum 30-minute planning cooldown; an
unchanged backlog cannot. A persisted daily attempt counter enforces configurable
`maxPlansPerDay` up to 24 (default24, UTC day), counting uncertain HTTP attempts
conservatively. Root independently enforces its planning/model ceilings. A stable
signature of backlog hash, last/next plan times and plan count deduplicates wakes.
The root planner must publish terminal state and the next due time after each
attempt. Idle 20-second reconciliation creates no model turns.

Planner wake payload is `{orwellPlannerToken: "..."}` with a stable idempotency key.
Its process adapter calls `client.py --role planner`; unlike product callbacks it
ignores injected issue IDs. The root socket request is
`{requestId,role:"planner",requestedAt}` without an item key. The bridge requires
its own persisted pending planner wake before starting that request, so an
arbitrary manual callback cannot bypass cooldown/daily-attempt accounting. Actual
planner state, timestamps and optional active native session/provider/model are
streamed from root planner observations, never synthesized as model activity.

The socket accepts one <=4096-byte newline JSON request:
`{"role":"codex|claude|orion","itemKey":"optional source key or mapped issue UUID"}`.
Planning accepts `{"role":"planner"}` instead.
It serializes requests, validates phase/role/scope/lease/retry/health, writes
`paperclip-request.json` as `{requestId,itemKey,role,requestedAt}`, then calls
`systemctl start --no-block orwell-agent-controller.service`. The controller must
fail closed unless `scope.paperclipManaged` is enabled and that root-owned request
is fresh (<=120 seconds at startup), scoped and role-compatible, and must filter
selection to that item. The bridge polls actual systemd state and public queue
facts for at most 13 minutes. It clears only its own request ID. Timeout requests
controller stop. Socket responses are bounded, sanitized observations of actual
phase, state, session, checkpoint and event logs. Client exit is nonzero for
holds/failures; wrong-role/not-eligible requests are noops with no model spend.

## Validation and pinned API

`python3 -m unittest -v test_bridge.py` is an isolated stdlib suite. It exercises
product filtering, stable mappings, state reconciliation, independent QA role,
unforgeable acceptance, scope/lease/retry/affinity/budget stops, peer UID, event
dedup, dynamic provider routing, opposite-provider QA, planner state/admission,
cooldown/material change, daily ceilings, pending-wake binding and actual planner
request observations. It never contacts a provider or starts a service.

Paperclip 2026.1012.0 commit `bba6a45f0d364cfd962ac59b3bdf2426a8222adb`
was inspected for the process adapter, wake schema and issue-comment schema.
The bridge uses loopback board-mode API routes: company issue GET/POST,
issue PATCH, issue comment GET/POST and agent POST wakeup. The installed version
keeps mirrored issues assigned to the board user with no agent assignee;
`resume:false` alone does not suppress all
comment wake behavior in the pinned issues route. Explicit wakes carry custom
`orwellIssueId`/`orwellItemKey` correlation fields and target the correct configured
role agent. Using the reserved `issueId` field without that agent as assignee causes the
pinned version to cancel the run as `issue_assignee_changed` before execution.
The root-private pending wake mapping supplies exact item binding to the adapter.


## Independent product gate

`verify-profile-facts.mjs` is the independently authored semantic birthday gate for the91-profile inventory. Install its exact reviewed bytes root-owned and read-only at `/opt/orwell-evidence/verify-profile-facts.mjs`; the private scope runs it after the author-written verifier. It compares the inventory against raw observations and normalizes equivalent full ISO, Spanish-written and day/month/year dates while preserving precision. Its `--self-test` covers equivalent dates, a true contradiction and invalid date/precision cases. An author verifier that regenerates the same buggy classification is insufficient, even if another model accepts it.

The root controller returns a failed product gate to the same author with actionable findings and requires fresh independent QA. It does not close the checkbox on model agreement alone. Issue descriptions expose the full trusted acceptance criteria, observed queue state and current native owner/model, in addition to bounded event comments.
