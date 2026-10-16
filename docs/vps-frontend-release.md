# Trusted VPS frontend release

`releaseFrontend({workspace,stateDir,itemKey,leaseId,revision,config,runCommand,verifyLive})` publishes reviewed application source through the normal Vercel CLI. Root calls it after the reviewed source commit and before product-specific production checks. It does not choose a task, change a budget, alter Git identity or mark a checklist complete.

Fixed target: project `prj_4CV6QZHLWPOAliUm2h9XRELZAzSV`, organization `team_a06hPQt8eiGGuT4QIVLOmoPY`, production `https://orwell-panama.vercel.app`. Configuration accepts only `cliPath`, `nodePath`, and matching copies of these target fields. Node defaults to `/opt/paperclip-runtime/bin/node`; root supplies the installed Vercel 64.0.2 JavaScript entry point. The helper runs this entry point with `deploy --yes --prod --archive=tgz`, UID/GID 0, `shell:false`, and an explicit small environment. No model-provided routing or commands participate.

Native authentication is derived solely from `stateDir/vercel-data/com.vercel.cli/auth.json`. `XDG_DATA_HOME` points at `stateDir/vercel-data`. Root must provision that native file as an actual root-owned regular file with mode 0600. The helper checks metadata and symlink-free ancestors without reading credential contents. It supplies no token argument or token environment variable and forwards no inference API keys. Symlinked workspace, auth, project or release-record paths fail closed. Root owns the ignored `.vercel` directory and canonical project file. An existing project pointing elsewhere is refused rather than silently rebound.

CLI success alone does not establish readiness. Root supplies `verifyLive(context)`, which must actually query Vercel for the immutable deployment and probe the production alias. The callback receives deployment URL, fixed project/org/production URL, item key, lease, revision and start time. Its required proof shape is:

```json
{
  "ready": true,
  "status": "READY",
  "deploymentId": "dpl_actualVercelId",
  "projectId": "prj_4CV6QZHLWPOAliUm2h9XRELZAzSV",
  "orgId": "team_a06hPQt8eiGGuT4QIVLOmoPY",
  "deploymentUrl": "https://orwell-panama-actual-team.vercel.app",
  "productionUrl": "https://orwell-panama.vercel.app",
  "productionStatus": 200,
  "checkedAt": 1790000000000,
  "evidence": "Actual Vercel READY response and production HTTP verification evidence."
}
```

The callback must derive these values from the actual deployment and HTTP response; copying expected inputs into an invented receipt is forbidden. `checkedAt` must be at or after this release started. Without deployment API access or a meaningful response, hold publication acceptance. An HTTP 200 homepage alone does not prove a new revision is READY or belongs to this project. Root can additionally save trusted browser screenshots using VPS Chrome. UI behavior and language acceptance remain product-specific post-checks and separate QA work.

The provided root implementation is `verifyFrontendLive({...context,stateDir})`. Bind it as `verifyLive:context=>verifyFrontendLive({...context,stateDir})`. It reads the derived private native auth only in root code, requests Vercel's v13 deployment API for both immutable URL and production alias, and requires matching deployment ID, fixed project/owner, READY state and production target. Its separate public GET receives no authentication. Errors include HTTP status but never native token contents or raw provider responses. Root `/etc/orwell-agent-controller/frontend.json` contains trusted CLI target fields plus `authorIdentity`; pass only the CLI fields to `releaseFrontend`, and pass `authorIdentity` separately to `commitReviewedSource`. Future normal commits retain that authorized canonical identity and explicit controller/task/worker/reviewer trailers. No old commits or deployment metadata are rewritten.

The standalone `source-commit.mjs` entry point also requires `loadReleaseAuthor()` from the same protected root configuration. It has no bot fallback in this production entry point, so a redundant systemd post-start invocation cannot silently create a nonmember-authored commit. The callable library retains its historical default for existing backend-only callers, while the current controller explicitly supplies the canonical identity.

VPS setup verified: Vercel 64.0.2 at `/opt/orwell-deploy/node_modules/vercel/dist/index.js`, Node 24.22.0 at `/opt/paperclip-runtime/bin/node`, Playwright 1.64.1 under `/opt/orwell-deploy/node_modules`, and Chrome 146.0.7680.164 at `/usr/bin/google-chrome`. A headless data-URL smoke test exercised the installed browser; it is not product QA. Use `createRequire('/opt/orwell-deploy/package.json')('playwright')` from a root verification script and launch Chrome with `--no-sandbox` and `--disable-dev-shm-usage`. The actual API/alias/public-HTTP verifier also passed a read-only check against the already-existing production deployment `dpl_CgPy2SQ5Wiz3C287zVBTPoerEcsG`; no new deployment or completion record was created by that check.

Only successful CLI exit plus matching current READY proof writes root-owned 0600 `stateDir/frontend-deployment.json`. The record binds item, lease and reviewed revision, preserves actual command output and includes the live proof. Root's overall acceptance proof must use this record and the later product checks. Failure preserves the task for repair; the helper never manufactures a completion marker. Tests use isolated filesystem ownership adapters and mocked command/probe callbacks, with no network, real credentials or deployment.
