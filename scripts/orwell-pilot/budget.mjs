/** Subscription admission uses provider percentages, never token-to-quota guesses. */
export const WEEK_MINUTES = 7 * 24 * 60;
const validPct = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100;
const inactiveClaudeWindow=(snapshot,w)=>snapshot.provider==='claude'&&snapshot.source==='claude-code/native-oauth-usage'&&snapshot.authType==='claudeAi'&&snapshot.creditsEnabled===false&&w.id==='five_hour'&&w.durationMinutes===300&&w.inactive===true&&w.usedPercent===0&&w.resetsAt===null&&!w.reached;
// Native Codex occasionally shifts the same weekly reset clock by a second.
// Compare only verified ChatGPT measurements, never rewrite the saved baseline.
const sameWeeklyCycle=(snapshot,baseline,current,prior,now)=>current.resetsAt===prior.resetsAt||(
 snapshot.provider==='codex'&&baseline.provider==='codex'&&snapshot.source==='account/rateLimits/read'&&baseline.source==='account/rateLimits/read'&&snapshot.authType==='chatgpt'&&baseline.authType==='chatgpt'&&
 current.durationMinutes===WEEK_MINUTES&&prior.durationMinutes===WEEK_MINUTES&&Number.isSafeInteger(current.resetsAt)&&Number.isSafeInteger(prior.resetsAt)&&
 current.resetsAt*1000>now&&prior.resetsAt*1000>now&&Math.abs(current.resetsAt-prior.resetsAt)<=2);


export function codexSnapshot(result, now = Date.now()) {
  const buckets = result?.rateLimitsByLimitId ?? (result?.rateLimits ? {legacy: result.rateLimits} : {});
  const windows = Object.entries(buckets).flatMap(([bucket, limits]) =>
    ['primary', 'secondary'].filter(slot => limits?.[slot]).map(slot => ({
      id: `${bucket}/${slot}`, bucket, usedPercent: limits[slot].usedPercent,
      durationMinutes: limits[slot].windowDurationMins, resetsAt: limits[slot].resetsAt,
      reached: Boolean(limits.spendControlReached || limits.rateLimitReachedType),
    })));
  return {provider: 'codex', source: 'account/rateLimits/read', observedAt: now, windows};
}

export function claudeSnapshot(payload, now = Date.now()) {
  const windows = Object.entries(payload?.rate_limits ?? {}).flatMap(([id, row]) => {
    if (!['five_hour', 'seven_day'].includes(id)) return [];
    return [{id, usedPercent: row?.used_percentage,
      durationMinutes: id === 'seven_day' ? WEEK_MINUTES : 300, resetsAt: row?.resets_at}];
  });
  return {provider: 'claude', source: 'claude-code/statusline', observedAt: now, windows};
}

export function validateSnapshot(snapshot, now = Date.now(), maxAgeMs = 120_000) {
  if (!snapshot || !Number.isFinite(snapshot.observedAt) || snapshot.observedAt > now + 5_000 ||
      now - snapshot.observedAt > maxAgeMs) return 'Usage is missing, stale or future-dated';
  if (!Array.isArray(snapshot.windows) || !snapshot.windows.some(w => w.durationMinutes === WEEK_MINUTES))
    return 'A measured weekly subscription window is required';
  if (new Set(snapshot.windows.map(w => w.id)).size !== snapshot.windows.length) return 'Duplicate usage windows';
  for (const w of snapshot.windows) {
    // Native Claude explicitly reports no active five-hour window as zero/null.
    // Keep that provider observation; never invent a reset or renew the week.
    if(inactiveClaudeWindow(snapshot,w))continue;
    if (!validPct(w.usedPercent) || !Number.isFinite(w.resetsAt) || w.resetsAt * 1000 <= now ||
        !Number.isFinite(w.durationMinutes) || w.durationMinutes <= 0) return 'Invalid or expired usage window';
    if (w.reached) return 'Provider reports a reached limit';
  }
  return null;
}

/** A pilot is a finite allocation. Resets or disappearing buckets require reconciliation. */
export function admitSubscription({snapshot, baseline, policy, activeRuns, now = Date.now()}) {
  const hold = reason => ({allowed: false, state: 'held', reason});
  if (!policy || policy.subscriptionOnly !== true || policy.allowPaidFallback !== false)
    return hold('Subscription-only policy is required');
  if (!validPct(policy.allocationPercentagePoints) || policy.allocationPercentagePoints === 0 || policy.allocationPercentagePoints > 30 ||
      !validPct(policy.reservePercentagePoints) || policy.reservePercentagePoints < 3 || policy.reservePercentagePoints >= policy.allocationPercentagePoints)
    return hold('Invalid allocation or safety reserve');
  if (!Number.isFinite(policy.startedAt) || !Number.isFinite(policy.endsAt) ||
      policy.startedAt > now || policy.endsAt <= now || policy.endsAt <= policy.startedAt || policy.endsAt-policy.startedAt > 24*60*60_000)
    return hold('Pilot window has not started or has ended');
  if (!Number.isSafeInteger(activeRuns) || activeRuns < 0 || activeRuns >= 1)
    return hold('Pilot permits one model run at a time');
  const invalid = validateSnapshot(snapshot, now, policy.maxSnapshotAgeMs ?? 120_000);
  if (invalid) return hold(invalid);
  if (!baseline || baseline.provider !== snapshot.provider || !Array.isArray(baseline.windows) ||
      baseline.windows.length === 0 || new Set(baseline.windows.map(w => w.id)).size !== baseline.windows.length)
    return hold('Provider baseline is missing or invalid');
  // Initialization reads the native meter before assigning startedAt. Allow only
  // bounded capture skew, never a replacement weekly measurement or renewal.
  if (!Number.isFinite(baseline.observedAt) || baseline.observedAt > now + 5_000 || baseline.observedAt < policy.startedAt - 5_000)
    return hold('Measured baseline is outside the pilot window');
  if (snapshot.windows.length !== baseline.windows.length)
    return hold('Metered windows changed; reconcile before spending');
  const remaining = [];
  const weekly = baseline.windows.filter(w => w.durationMinutes === WEEK_MINUTES).map(prior => ({
    prior, current: snapshot.windows.find(w => w.id === prior.id),
  }));
  if (!weekly.length || weekly.some(({current,prior}) => !current || !sameWeeklyCycle(snapshot,baseline,current,prior,now) || current.usedPercent < prior.usedPercent))
    return hold('Weekly usage reset, decreased or changed; reconcile before spending');
  for (const prior of baseline.windows) {
    const current = snapshot.windows.find(w => w.id === prior.id);
    if (!current || !validPct(prior.usedPercent) || current.durationMinutes !== prior.durationMinutes)
      return hold('Usage changed buckets; reconcile before spending');
    if(inactiveClaudeWindow(snapshot,current)){
      if(!inactiveClaudeWindow(baseline,prior)&&(!Number.isFinite(prior.resetsAt)||prior.resetsAt*1000>now))return hold('Inactive short window conflicts with unexpired baseline');
      continue;
    }
    if (current.durationMinutes === WEEK_MINUTES) {
      // A weekly reset ends the baseline's measurement window. Never roll the
      // allocation forward against the provider's new week.
      if (!sameWeeklyCycle(snapshot,baseline,current,prior,now) || current.usedPercent < prior.usedPercent)
        return hold('Weekly usage reset or decreased; reconcile before spending');
    } else if (current.resetsAt !== prior.resetsAt || current.usedPercent < prior.usedPercent) {
      // Short-window usage is account-wide too. A reset is safe to reconcile
      // only when the weekly window is unchanged and its original baseline is
      // still intact; the current short meter is then the new local baseline.
      // No durable reconciliation record is wired into admission yet.
      return hold('Short-window reset requires recorded reconciliation');
    }
    if (current.usedPercent >= 100 - policy.reservePercentagePoints)
      return hold('Provider allowance reserve reached');
  }
  if (!weekly.length) return hold('A measured weekly subscription window is required');
  for (const {current,prior} of weekly) {
    const used = current.usedPercent - prior.usedPercent;
    const available = policy.allocationPercentagePoints - policy.reservePercentagePoints - used;
    if (available <= 0) return hold('Pilot weekly allocation reserve reached');
    remaining.push({id: current.id, usedPercentagePoints: used, availablePercentagePoints: available});
  }
  return {allowed: true, state: 'admitted', remaining,
    limitation: 'Admission guard, not a provider-side hard quota. Delayed meters and an in-flight request can overshoot.'};
}

/** Input already includes cached input in Codex events; do not add it twice. */
export function normalizeCodexUsage(usage) {
  const count = n => Number.isSafeInteger(n) && n >= 0;
  if (!usage || !count(usage.input_tokens) || !count(usage.output_tokens) ||
      !count(usage.cached_input_tokens) || usage.cached_input_tokens > usage.input_tokens) return null;
  const total = usage.input_tokens + usage.output_tokens;
  if (!Number.isSafeInteger(total) || (usage.total_tokens !== undefined && usage.total_tokens !== total)) return null;
  return {...usage, total_tokens: total};
}

export function subscriptionEnvironment(env = process.env) {
  const allowed = /^(PATH|HOME|USER|LOGNAME|SHELL|LANG|LC_[A-Z_]+|TERM|COLORTERM|TMPDIR|TMP|TEMP|XDG_CONFIG_HOME|XDG_DATA_HOME|XDG_CACHE_HOME|CODEX_HOME|CLAUDE_CONFIG_DIR|SSL_CERT_FILE|SSL_CERT_DIR|NODE_EXTRA_CA_CERTS)$/;
  return Object.fromEntries(Object.entries(env).filter(([name]) => allowed.test(name)));
}

/** Roll only expired short windows; retain the original weekly allocation forever. */
export function reconcileShortWindows({snapshot, baseline, policy, now = Date.now()}) {
  if (validateSnapshot(snapshot, now, policy.maxSnapshotAgeMs ?? 120_000) || !baseline?.windows) return {baseline, records: []};
  const records = [];
  const windows = baseline.windows.map(prior => {
    const current = snapshot.windows.find(w => w.id === prior.id);
    if (prior.durationMinutes === WEEK_MINUTES || !current || inactiveClaudeWindow(snapshot,current) || prior.resetsAt * 1000 > now ||
        current.resetsAt <= prior.resetsAt || current.durationMinutes !== prior.durationMinutes || !validPct(prior.usedPercent)) return prior;
    records.push({id: prior.id, at: now, previous: prior, current});
    return {...current};
  });
  const candidate = {...baseline, windows};
  // Admission still checks original weekly meters, policy dates and all reserves.
  if (!records.length || !admitSubscription({snapshot, baseline: candidate, policy, activeRuns: 0, now}).allowed)
    return {baseline, records: []};
  return {baseline: candidate, records};
}
