#!/usr/bin/env python3
"""Root control-plane bridge. No model credentials, inference, or Convex writes."""
import argparse
import fcntl
import hashlib
import json
import logging
import os
from pathlib import Path
import re
import signal
import socket
import socketserver
import stat
import struct
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

PUBLIC_QUEUE = "https://fleet-vole-527.convex.cloud"
UNIT = "orwell-agent-controller.service"
BASE_ROLES = {"codex", "claude", "orion"}
ROLES = BASE_ROLES | {"planner"}
MAX_REQUEST = 4096
MAX_RESPONSE = 8192
MAX_HTTP = 8 * 1024 * 1024
TIMEOUT = 13 * 60
KEY = re.compile(r"^[a-z0-9][a-z0-9-]{0,159}/[a-z0-9][a-z0-9-]{0,159}$")
UUID = re.compile(r"^[0-9a-fA-F-]{36}$")
# These are orchestration/UI-of-agents tasks, not the actual Orwell product.
CONTROL_TASKS = {
    "voice-runtime-handoff", "expand-orwell-runtime", "live-agent-scoreboard",
    "lead-orchestration-accountability", "workstation-awake", "step-accountability",
    "accurate-active-assignments", "continuous-agent-dispatch-20261009",
    "task-timestamps", "shared-scoreboard", "scoreboard-redesign",
    "realistic-agent-portraits", "explain-agent-errors", "orwell-runtime-team-registry",
}
CONTROL_WORDS = re.compile(r"(?:^|-)(?:agent|agents|avatar|avatars|pilot|controller|orchestration)(?:-|$)")
READY = {"ready", "triage_ready", "qa_ready", "accept_ready"}
STOP = threading.Event()


def now_ms():
    return int(time.time() * 1000)


def clean(value, limit=2000):
    """Bound public observations and redact common credential-like fragments."""
    value = re.sub(r"[\x00-\x08\x0b-\x1f\x7f]", "", str(value))
    value = re.sub(r"(?i)\b(?:Bearer|Convex)\s+[A-Za-z0-9_./:+~=-]+", "[redacted authorization]", value)
    value = re.sub(r"(?i)(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret|authorization)\s*[:=]\s*[^\s,;]+", "[redacted credential]", value)
    value = re.sub(r"\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{20,})\b", "[redacted token]", value)
    value = re.sub(r"(https?://)[^\s/@]+:[^\s/@]+@", r"\1[redacted]@", value)
    return value[:limit]


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    temp = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(fd, "w") as handle:
            json.dump(value, handle, separators=(",", ":"))
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp, path)
        directory = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        temp.unlink(missing_ok=True)


def read_json(path, default=None):
    try:
        with open(path) as handle:
            return json.load(handle)
    except FileNotFoundError:
        if default is not None:
            return default
        raise


def root_private(path):
    info = os.stat(path, follow_symlinks=False)
    if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
        raise ValueError("Root-owned regular configuration without group/other writes required")


def peer_allowed(sock, paperclip_uid):
    if not hasattr(socket, "SO_PEERCRED"):
        return False
    _, uid, _ = struct.unpack("3i", sock.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, 12))
    return uid in {0, paperclip_uid}


def product_task(task):
    key = task.get("key", "")
    return (bool(key) and task.get("status") != "superseded"
            and not task.get("supersededBy") and key not in CONTROL_TASKS
            and not CONTROL_WORDS.search(key))


def english(value):
    return value.get("en", "") if isinstance(value, dict) else str(value or "")


def claude_model(value):
    value = value.strip().lower() if isinstance(value, str) else ""
    for profile in ("sonnet", "opus"):
        if re.fullmatch(r"(?:claude-)?" + profile + r"(?:-\d+(?:[.-]\d+)*)?", value):
            return profile
    return None


def phase_role(item):
    state = item.get("state")
    if state in {"qa_ready", "qa_running"}:
        author = item.get("workerProvider")
        return "qa", ("claude" if author == "codex" else "codex" if author == "claude" else item.get("qaProvider") or "claude")
    if state in {"accept_ready", "accept_running", "accepted"}:
        return "accept", "orion"
    if state == "triage_ready" or (state in {"ready", "running"} and item.get("lead") == "Orion"):
        return "triage", "orion"
    return "work", item.get("workerProvider") or "codex"


def issue_status(item, step, in_scope):
    # Paperclip can never provide acceptance authority.
    if step.get("done") is True and item.get("state") == "accepted":
        return "done"
    if step.get("done") is True and not item.get("state"):
        return "done"  # preserve historical completion recorded before dispatch existed
    if step.get("done") or item.get("state") == "accepted":
        return "blocked"  # mismatched source facts need reconciliation
    if not in_scope:
        return "backlog"
    state = item.get("state")
    if state == "blocked":
        return "blocked"
    if state in {"qa_ready", "qa_running", "accept_ready", "accept_running"}:
        return "in_review"
    if state == "running":
        return "in_progress"
    return "todo"


def event_id(event):
    raw = json.dumps({key: event.get(key) for key in ("itemKey", "kind", "actor", "at", "detail")}, sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()


class HTTP:
    def request(self, url, method="GET", body=None):
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(url, data, headers={"Content-Type": "application/json"}, method=method)
        # No ambient proxies or provider credentials are used for this control plane.
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(request, timeout=20) as response:
            payload = response.read(MAX_HTTP + 1)
        if len(payload) > MAX_HTTP:
            raise ValueError("Control-plane response too large")
        return json.loads(payload) if payload else None


class Bridge:
    def __init__(self, config, http=None):
        self.config = config
        self.http = http or HTTP()
        self.state = Path(config.get("stateDirectory", "/var/lib/orwell-paperclip"))
        self.controller = Path(config.get("controllerStateDirectory", "/var/lib/orwell-agent-controller"))
        self.scope_path = Path(config.get("scopePath", self.controller / "scope.json"))
        self.policy_path = Path(config.get("policyPath", self.controller / "policy.json"))
        self.usage_path = Path(config.get("usagePath", self.controller / "usage.json"))
        self.routing_path = Path(config.get("routingPath", self.controller / "routing.json"))
        self.planner_path = Path(config.get("plannerPath", self.controller / "planner.json"))
        self.request_path = self.controller / "paperclip-request.json"
        self.mapping_path = self.state / "mapping.json"
        self.mapping = read_json(self.mapping_path, {"version": 1, "items": {}, "wakes": {}})
        self.mapping.setdefault("wakes", {})
        self.mapping_lock = threading.RLock()
        self.run_lock = threading.Lock()
        self.sync_lock = threading.Lock()
        self.paperclip = config["paperclipUrl"].rstrip("/")
        parsed = urllib.parse.urlsplit(self.paperclip)
        if parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost", "::1"} or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in {"", "/"}:
            raise ValueError("Paperclip must be a loopback HTTP origin")
        if not isinstance(config.get("paperclipUid"), int) or config["paperclipUid"] <= 0:
            raise ValueError("An isolated Paperclip UID is required")
        if (not UUID.fullmatch(config["companyId"]) or not BASE_ROLES <= set(config["agents"])
                or set(config["agents"]) - ROLES or any(not UUID.fullmatch(x) for x in config["agents"].values())):
            raise ValueError("Company and role agent UUIDs are required")
        self.company_path = f"/api/companies/{config['companyId']}"

    def save(self):
        with self.mapping_lock:
            atomic_json(self.mapping_path, self.mapping)

    def recover_request(self):
        """After a bridge restart, retire only a persisted request owned by us."""
        with self.mapping_lock:
            own = self.mapping.get("activeRequest")
        if not own or self.run_lock.locked():
            return
        unit = self.unit_state()
        if unit.get("ActiveState") not in {"inactive", "failed"}:
            return
        current = read_json(self.request_path, {})
        if current and current.get("requestId") != own.get("requestId"):
            return  # a root operator or another owner replaced it
        if current:
            self.request_path.unlink(missing_ok=True)
        with self.mapping_lock:
            self.mapping.pop("activeRequest", None)
            self.save()

    def pc(self, path, method="GET", body=None):
        return self.http.request(self.paperclip + path, method, body)

    def convex(self, name):
        response = self.http.request(PUBLIC_QUEUE + "/api/query", "POST", {"path": name, "args": {}, "format": "json"})
        if response.get("status") != "success":
            raise ValueError("Public queue unavailable")
        return response["value"]

    def facts(self):
        snapshot = self.convex("dispatch:snapshot")
        tasks = self.convex("scoreboard:list")
        health = self.convex("controllerStatus:snapshot")
        if not isinstance(snapshot.get("items"), list) or not isinstance(tasks, list):
            raise ValueError("Invalid queue observations")
        return snapshot, tasks, health

    def scope(self):
        actual = read_json(self.scope_path)
        if self.config.get("followControllerScope", False):
            if actual.get("serverPlanning") is not True:
                raise ValueError("Following root-planned scope requires serverPlanning authorization")
            keys = actual.get("itemKeys")
            if not isinstance(keys, list) or not all(isinstance(k, str) and KEY.fullmatch(k) for k in keys):
                raise ValueError("Explicit controller scope required")
            return set(keys)
        configured = self.config["scope"]
        configured = configured.get("itemKeys") if isinstance(configured, dict) else configured
        actual = actual.get("itemKeys")
        if not isinstance(actual, list) or not isinstance(configured, list) or not all(isinstance(k, str) and KEY.fullmatch(k) for k in actual + configured):
            raise ValueError("Explicit controller scope required")
        return set(actual) & set(configured)

    def routing_row(self, item, now=None):
        now = now_ms() if now is None else now
        routing = read_json(self.routing_path, {})
        observed = routing.get("observedAt")
        if not isinstance(observed, (int, float)) or not now - 120000 <= observed <= now + 5000:
            return None
        row = routing.get("items", {}).get(item.get("key"), {})
        phase = phase_role(item)[0]
        expected = {"orion"} if phase in {"triage", "accept"} else {"codex", "claude"}
        if row.get("phase") != phase or row.get("role") not in expected:
            return None
        return row

    def item_phase_role(self, item, now=None):
        phase, legacy_role = phase_role(item)
        if phase in {"triage", "accept"} or not self.config.get("providerRouting", False):
            return phase, legacy_role
        row = self.routing_row(item, now)
        if row:
            return phase, row.get("role")
        actual = item.get("workerProvider") if phase == "work" else item.get("qaProvider")
        if item.get("state") in {"running", "qa_running"} and actual in {"codex", "claude"}:
            return phase, actual
        return phase, None

    def budget_reason(self, health, now, provider=None, authoritative=False):
        policy = read_json(self.policy_path)
        # Read only. Never reset baselines, extend deadlines, or expand allocation.
        if policy.get("subscriptionOnly") is not True or policy.get("allowPaidFallback") is not False:
            return "Subscription policy held"
        if (policy.get("allocationPercentagePoints") != 30 or policy.get("reservePercentagePoints") != 3
                or not isinstance(policy.get("startedAt"), (int, float))
                or not isinstance(policy.get("endsAt"), (int, float))
                or not policy["startedAt"] <= now < policy["endsAt"]):
            return "Original allocation window held"
        if authoritative:
            # A fresh allowed root route includes the global pause and native
            # admission checks. A generic old provider hold cannot veto its peer.
            return None
        if not health or health.get("state") in {"held", "failed", "error", "paused", "checking"}:
            return "Controller health held"
        local_health = read_json(self.controller / "health.json", {})
        if local_health.get("state") in {"held", "failed", "error", "paused"}:
            return "Controller health held"
        usage = read_json(self.usage_path, {})
        # These are prior observed admissions. The controller always re-meters before a CLI.
        needed = [provider] if provider in {"codex", "claude"} else ["codex", "claude"]
        if any(usage.get("checks", {}).get(role, {}).get("allowed") is not True for role in needed):
            return "Observed native subscription admission held"
        return None

    def eligible(self, item, task, step, role, snapshot, health, now=None):
        now = now_ms() if now is None else now
        if not item or not task or not step or not product_task(task):
            return "Not a product checklist item"
        if item.get("key") not in self.scope():
            return "Outside controller scope"
        if step.get("done") is not False or task.get("status") not in {"todo", "doing"}:
            return "Original checklist is not open"
        if any((i.get("leaseUntil") or 0) > now for i in snapshot["items"]):
            return "An active controller lease exists"
        if item.get("state") not in READY:
            return "Phase is not ready"
        phase, selected_role = self.item_phase_role(item, now)
        dynamic = self.config.get("providerRouting", False)
        if dynamic:
            route = self.routing_row(item, now)
            if not route or route.get("allowed") is not True:
                return "Authoritative provider routing held"
            if phase == "qa":
                author = item.get("workerProvider")
                if author not in {"codex", "claude"}:
                    return "Independent QA provider held"
                if role == author:
                    scope = read_json(self.scope_path, {})
                    worker_model = claude_model(item.get("workerModel"))
                    target_model = (claude_model(route["model"]) if "model" in route else
                                    ("opus" if worker_model == "sonnet" else "sonnet" if worker_model == "opus" else None))
                    if (scope.get("reviewMode") != "claude-cross-model" or author != "claude"
                            or not worker_model or not target_model or worker_model == target_model):
                        return "Independent QA provider or Claude model held"
        if selected_role != role:
            return "Role does not own the observed phase"
        if (item.get("retryAt") or 0) > now:
            return "Recorded retry is not due"
        affinity = read_json(self.controller / "affinity.json", {})
        if affinity and affinity.get("itemKey") != item["key"]:
            owner = next((i for i in snapshot["items"] if i["key"] == affinity.get("itemKey")), None)
            if owner is None or owner.get("state") not in {"accepted", "superseded"}:
                return "Workspace belongs to another checklist item"
        return self.budget_reason(health, now, role if dynamic else None, authoritative=dynamic)

    def planner_reason(self, snapshot, tasks, health, now=None, for_request=False):
        now = now_ms() if now is None else now
        if "planner" not in self.config["agents"] or not self.config.get("enablePlanningWakeups", False):
            return "Server planner is not enabled"
        scope = read_json(self.scope_path, {})
        if scope.get("serverPlanning") is not True:
            return "Server planning scope is not authorized"
        if any((i.get("leaseUntil") or 0) > now for i in snapshot["items"]):
            return "An active controller lease exists"
        planner = read_json(self.planner_path, {})
        if planner.get("planningAllowed") is not True or planner.get("state") in {"held", "planning"}:
            return "Root planner held"
        due = planner.get("nextPlanAt")
        if not isinstance(due, (int, float)) or due > now:
            return "Planner retry is not due"
        routing = read_json(self.routing_path, {})
        observed = routing.get("observedAt")
        route = routing.get("planner", {})
        if (not isinstance(observed, (int, float)) or not now - 120000 <= observed <= now + 5000
                or route.get("allowed") is not True or route.get("role") not in {"codex", "claude"}):
            return "Authoritative planner admission held"
        policy_hold = self.budget_reason(health, now, authoritative=True)
        if policy_hold:
            return policy_hold
        steps = self.product_steps(tasks)
        for item in snapshot["items"]:
            if item["key"] not in steps:
                continue
            role = self.item_phase_role(item, now)[1]
            task, step = steps[item["key"]]
            if role and not self.eligible(item, task, step, role, snapshot, health, now):
                return "An authorized product phase is already eligible"
        backlog_hash = planner.get("backlogHash")
        if not isinstance(backlog_hash, str) or not backlog_hash or len(backlog_hash) > 200:
            return "Planner backlog observation held"
        with self.mapping_lock:
            last_wake = self.mapping.get("plannerWake", {})
            daily = self.mapping.get("plannerDaily", {})
        pending = (last_wake.get("state") == "attempted" and last_wake.get("token") == self.planner_token(planner))
        if for_request and not pending:
            return "No trusted planner wake is pending"
        previous_hash = last_wake.get("backlogHash") or planner.get("lastBacklogHash")
        changed = previous_hash is not None and previous_hash != backlog_hash
        last = max(planner.get("lastPlanAt") or 0, 0 if for_request else last_wake.get("at") or 0)
        if last and now - last < 30 * 60 * 1000 and not changed:
            return "Planner cooldown is not due"
        day = time.strftime("%Y-%m-%d", time.gmtime(now / 1000))
        limit = min(24, max(1, int(self.config.get("maxPlansPerDay", self.config.get("plannerDailyLimit", 24)))))
        if not for_request and daily.get("day") == day and daily.get("count", 0) >= limit:
            return "Planner daily limit held"
        return None

    @staticmethod
    def planner_token(planner):
        return hashlib.sha256(json.dumps([planner.get(key) for key in
            ("backlogHash", "lastPlanAt", "nextPlanAt", "planCount")]).encode()).hexdigest()

    def wake_planner(self, snapshot, tasks, health):
        if self.planner_reason(snapshot, tasks, health):
            return
        planner = read_json(self.planner_path)
        token = self.planner_token(planner)
        with self.mapping_lock:
            if self.mapping.get("plannerWake", {}).get("token") == token:
                return
            day = time.strftime("%Y-%m-%d", time.gmtime(now_ms() / 1000))
            daily = self.mapping.get("plannerDaily", {})
            count = daily.get("count", 0) if daily.get("day") == day else 0
            self.mapping["plannerDaily"] = {"day": day, "count": count + 1}
            self.mapping["plannerWake"] = {"token": token, "backlogHash": planner["backlogHash"], "at": now_ms(), "state": "attempted"}
            self.save()
        self.pc(f"/api/agents/{self.config['agents']['planner']}/wakeup", "POST", {
            "source": "automation", "triggerDetail": "system", "reason": "orwell_server_planning_ready",
            "payload": {"orwellPlannerToken": token}, "idempotencyKey": "orwell-planner:" + token,
        })

    @staticmethod
    def product_steps(tasks):
        return {f"{task['key']}/{step['key']}": (task, step)
                for task in tasks if product_task(task)
                for step in task.get("checklist", [])
                if KEY.fullmatch(f"{task['key']}/{step['key']}")}

    def resolve(self, requested, role, snapshot, tasks, health):
        steps = self.product_steps(tasks)
        if requested:
            with self.mapping_lock:
                matched = [key for key, row in self.mapping["items"].items() if key == requested or row.get("issueId") == requested]
            if len(matched) != 1:
                return None, "Issue has no unique trusted mapping"
            keys = matched
        else:
            with self.mapping_lock:
                pending = sorted(((key, row) for key, row in self.mapping["wakes"].items()
                                  if row.get("role") == role and row.get("state") == "attempted"),
                                 key=lambda pair: pair[1].get("at", 0), reverse=True)
            # The pinned generic process adapter does not inject an issue ID.
            # Bind its role-only callback to the specific persisted explicit wake.
            with self.mapping_lock:
                keys = [pending[0][0]] if pending else sorted((key for key in steps if key in self.mapping["items"]), key=self.priority)
        for key in keys:
            item = next((i for i in snapshot["items"] if i["key"] == key), None)
            task, step = steps.get(key, (None, None))
            reason = self.eligible(item, task, step, role, snapshot, health)
            if not reason:
                return item, None
            if requested:
                return None, reason
        return None, "No eligible product step for this role"

    def sync(self, wake=True):
        # The HTTP socket thread and scheduler may both request reconciliation.
        if not self.sync_lock.acquire(blocking=False):
            return
        try:
            self.recover_request()
            snapshot, tasks, health = self.facts()
            allowed = self.scope()
            steps = self.product_steps(tasks)
            items = {i["key"]: i for i in snapshot["items"]}
            criteria = read_json(self.scope_path, {}).get("criteria", {})
            active = {i["key"]: i for i in (health or {}).get("active", [])}
            remote = self.pc(self.company_path + "/issues")
            if not isinstance(remote, list):
                raise ValueError("Expected the Paperclip issue list")
            by_id = {i["id"]: i for i in remote}
            for key, (task, step) in steps.items():
                item = items.get(key, {})
                status = issue_status(item, step, key in allowed)
                role = self.item_phase_role(item)[1] if item else "orion"
                desired = {
                    "title": clean(f"{english(task['title'])}: {english(step['label'])}", 230),
                    "description": (f"<!-- orwell:{key} -->\n"
                        f"Original checklist: {key}\n\n{clean(english(task.get('detail')), 2500)}\n\n"
                        f"Acceptance: {clean(criteria.get(key) or english(step['label']), 7000)}\n\n"
                        f"Observed queue state: {clean(item.get('state') or 'historical record', 100)}.\n"
                        + (f"Observed native worker: {clean(active[key].get('owner'), 160)}. Model: {clean(active[key].get('model'), 160)}.\n" if key in active else "")
                        +
                        f"Guarded phase owner: {role or 'pending root provider selection'}. Paperclip process agent: {self.config['agents'].get(role, 'not selected')}.\n\n"
                        "Convex owns acceptance and checkbox facts. Only the guarded root controller may execute this issue."
                        + ("\nHistorical recorded completion, no new controller acceptance." if step.get("done") is True and not item.get("state") else "")
                        + ("\nOutside the current authorized execution scope." if key not in allowed else "")),
                    # Pinned Paperclip unconditionally wakes assigned agents for
                    # board comments. Board-managed issues plus explicit wakes
                    # avoid phantom process runs; active issues require an owner.
                    "status": status, "assigneeAgentId": self.config["agents"][role] if self.config.get("assignAgents", False) and role else None,
                    "assigneeUserId": None if self.config.get("assignAgents", False) and role else self.config.get("boardUserId", "local-board"),
                }
                marker = f"<!-- orwell:{key} -->"
                with self.mapping_lock:
                    row = self.mapping["items"].get(key)
                existing = by_id.get(row.get("issueId")) if row else None
                if not existing:
                    matches = [i for i in remote if marker in (i.get("description") or "")]
                    if len(matches) > 1:
                        raise ValueError("Duplicate source issue mapping requires root review")
                    existing = matches[0] if matches else None
                if not existing:
                    # Stable idempotency covers the HTTP/create-before-save crash window.
                    existing = self.pc(self.company_path + "/issues", "POST", {
                        **desired, "idempotencyKey": "orwell:" + key,
                    })
                    remote.append(existing)
                issue_id = existing["id"]
                if not UUID.fullmatch(issue_id):
                    raise ValueError("Invalid Paperclip issue ID")
                with self.mapping_lock:
                    row = self.mapping["items"].setdefault(key, {"eventHashes": []})
                    row["issueId"] = issue_id
                    self.save()
                patch = {k: value for k, value in desired.items() if existing.get(k) != value}
                if patch:
                    self.pc(f"/api/issues/{issue_id}", "PATCH", patch)
                events = sorted((e for e in snapshot.get("events", []) if e.get("itemKey") == key), key=lambda e: e.get("at", 0))
                pending = [e for e in events if event_id(e) not in row["eventHashes"]]
                if pending:
                    # Markers recover event dedup if POST succeeded before the local save.
                    comments = self.pc(f"/api/issues/{issue_id}/comments")
                    if not isinstance(comments, list):
                        raise ValueError("Expected Paperclip issue comments")
                    posted = "\n".join(c.get("body", "") for c in comments)
                    for event in pending[-20:]:
                        digest = event_id(event)
                        event_marker = f"[orwell-event:{digest}]"
                        if event_marker not in posted:
                            self.pc(f"/api/issues/{issue_id}/comments", "POST", {
                                "body": f"{event_marker}\nObserved Convex event at {event.get('at')}: {clean(event.get('kind'), 100)} / {clean(event.get('actor'), 160)}\n{clean(event.get('detail'), 2400)}",
                                "reopen": False,
                                "resume": False,
                                "clientRequestId": str(uuid.uuid5(uuid.NAMESPACE_URL, "orwell-event:" + digest)),
                            })
                        with self.mapping_lock:
                            row["eventHashes"] = (row["eventHashes"] + [digest])[-200:]
                            self.save()
            if wake and self.config.get("enableWakeups", False):
                self.wake_ready(snapshot, tasks, health)
        finally:
            self.sync_lock.release()

    def priority(self, key):
        configured = self.config.get("scope", {})
        ordered = self.config.get("priorityItemKeys", configured.get("itemKeys", []) if isinstance(configured, dict) else configured)
        if self.config.get("followControllerScope", False):
            ordered = list(dict.fromkeys([*ordered, *read_json(self.scope_path, {}).get("itemKeys", [])]))
        return ordered.index(key) if key in ordered else len(ordered)

    def wake_token(self, item):
        return hashlib.sha256(json.dumps([item["key"], item.get("state"), item.get("updatedAt"), item.get("retryAt"),
            item.get("attempt"), item.get("qaAttempt"), item.get("acceptAttempt"), self.item_phase_role(item)[1]]).encode()).hexdigest()

    def wake_ready(self, snapshot, tasks, health):
        if self.run_lock.locked() or self.request_path.exists():
            return
        steps = self.product_steps(tasks)
        with self.mapping_lock:
            pending = dict(self.mapping["wakes"])
        for item in snapshot["items"]:
            record = pending.get(item["key"], {})
            if record.get("state") == "attempted" and record.get("token") == self.wake_token(item):
                return  # an explicit process wake is already queued or uncertain
        # One explicit wake at a time, even when many issues were imported.
        for item in sorted(snapshot["items"], key=lambda i: (self.priority(i["key"]), i.get("taskOrder", 9999), i["key"])):
            key = item["key"]
            if key not in steps:
                continue
            task, step = steps[key]
            role = self.item_phase_role(item)[1]
            if not role:
                continue
            if self.eligible(item, task, step, role, snapshot, health):
                continue
            with self.mapping_lock:
                row = self.mapping["items"].get(key)
                if not row:
                    continue
                token = self.wake_token(item)
                if self.mapping["wakes"].get(key, {}).get("token") == token:
                    continue
                # Persist BEFORE POST: an uncertain request never creates an automatic retry loop.
                self.mapping["wakes"][key] = {"token": token, "at": now_ms(), "role": role, "state": "attempted"}
                self.save()
            self.pc(f"/api/agents/{self.config['agents'][role]}/wakeup", "POST", {
                "source": "automation", "triggerDetail": "system", "reason": "orwell_phase_ready",
                # An unassigned issueId triggers Paperclip's stale-assignee gate.
                # Carry source correlation without claiming Paperclip task authority.
                "payload": {"orwellIssueId": row["issueId"], "orwellItemKey": key}, "idempotencyKey": "orwell:" + token,
            })
            return
        self.wake_planner(snapshot, tasks, health)

    @staticmethod
    def unit_state():
        output = subprocess.run(["/usr/bin/systemctl", "show", UNIT,
            "--property=ActiveState,SubState,Result,ExecMainStatus"], capture_output=True, text=True, timeout=10, check=True).stdout
        return dict(line.split("=", 1) for line in output.splitlines() if "=" in line)

    def observed(self, item, snapshot):
        phase, role = self.item_phase_role(item)
        events = [{k: (clean(e.get(k), 1800) if k in {"detail", "actor", "kind"} else e.get(k))
                   for k in ("at", "kind", "actor", "detail")}
                  for e in snapshot.get("events", []) if e.get("itemKey") == item["key"]][:3]
        return {"itemKey": item["key"], "phase": phase, "role": role, "state": item.get("state"),
                "actor": clean(item.get("activeActorName") or "", 160),
                "sessionId": clean(item.get("activeSessionId") or "", 160),
                "checkpoint": clean(item.get("checkpoint") or "", 1800),
                "leaseUntil": item.get("leaseUntil"), "events": events}

    def observed_planner(self):
        planner = read_json(self.planner_path, {})
        return {"phase": "planning", "role": "planner", "state": clean(planner.get("state") or "unknown", 100),
                "sessionId": clean(planner.get("activeSessionId") or "", 160),
                "provider": clean(planner.get("activeProvider") or "", 50),
                "model": clean(planner.get("activeModel") or "", 160),
                "checkpoint": clean(planner.get("checkpoint") or planner.get("lastError") or "", 1800),
                "lastError": clean(planner.get("lastError") or "", 1800),
                "lastPlanAt": planner.get("lastPlanAt"), "nextPlanAt": planner.get("nextPlanAt"),
                "planCount": planner.get("planCount"), "backlogHash": clean(planner.get("backlogHash") or "", 200)}

    def run(self, request, emit):
        if not isinstance(request, dict) or set(request) - {"role", "itemKey"} or request.get("role") not in ROLES:
            emit({"status": "error", "reason": "Invalid request"})
            return
        requested = request.get("itemKey")
        is_planner = request["role"] == "planner"
        if is_planner and requested is not None:
            emit({"status": "error", "reason": "Planner request cannot identify a product item"})
            return
        if requested is not None and (not isinstance(requested, str) or not (KEY.fullmatch(requested) or UUID.fullmatch(requested))):
            emit({"status": "error", "reason": "Invalid item identifier"})
            return
        if not self.run_lock.acquire(blocking=False):
            emit({"status": "noop", "reason": "Controller bridge busy"})
            return
        own_id = str(uuid.uuid4())
        lock_handle = None
        try:
            self.state.mkdir(parents=True, mode=0o700, exist_ok=True)
            lock_handle = open(self.state / "controller.lock", "a")
            try:
                fcntl.flock(lock_handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                emit({"status": "noop", "reason": "Controller bridge busy"})
                return
            unit = self.unit_state()
            # A read-only meter tick can win the unit race after a wake was
            # persisted. Wait for it rather than consuming the sole wake as a noop.
            for _ in range(55):
                if unit.get("ActiveState") in {"inactive", "failed"} or STOP.is_set():
                    break
                STOP.wait(1)
                unit = self.unit_state()
            if unit.get("ActiveState") not in {"inactive", "failed"}:
                emit({"status": "noop", "reason": "Controller unit is active"})
                return
            snapshot, tasks, health = self.facts()
            item = None
            if is_planner:
                reason = self.planner_reason(snapshot, tasks, health, for_request=True)
                before_planner = self.observed_planner()
            else:
                item, reason = self.resolve(requested, request["role"], snapshot, tasks, health)
            if reason:
                emit({"status": "held" if "held" in reason.lower() else "noop", "reason": reason})
                return
            prior = read_json(self.request_path, {})
            if prior:
                emit({"status": "noop", "reason": "An existing controller request is pending"})
                return
            selection = {} if is_planner else {"itemKey": item["key"]}
            with self.mapping_lock:
                self.mapping["activeRequest"] = {"requestId": own_id, **selection, "role": request["role"]}
                self.save()
            atomic_json(self.request_path, {"requestId": own_id, **selection, "role": request["role"], "requestedAt": now_ms()})
            with self.mapping_lock:
                wake = self.mapping.get("plannerWake") if is_planner else self.mapping["wakes"].get(item["key"])
                if wake and (is_planner or wake.get("role") == request["role"]):
                    wake["state"] = "dispatched"
                    self.save()
            # No shell and no CLI launched here; systemd invokes the existing root controller.
            subprocess.run(["/usr/bin/systemctl", "start", "--no-block", UNIT], capture_output=True, timeout=15, check=True)
            started = time.monotonic()
            previous = None
            while time.monotonic() - started < TIMEOUT and not STOP.is_set():
                snapshot, _, health = self.facts()
                current = None if is_planner else next((i for i in snapshot["items"] if i["key"] == item["key"]), item)
                observation = self.observed_planner() if is_planner else self.observed(current, snapshot)
                serial = json.dumps(observation, sort_keys=True)
                if serial != previous:
                    emit({"status": "observed", **observation})
                    previous = serial
                unit = self.unit_state()
                if unit.get("ActiveState") not in {"active", "activating", "reloading", "deactivating"} and time.monotonic() - started >= 2:
                    succeeded = (unit.get("Result") == "success" and unit.get("ExecMainStatus") == "0")
                    if is_planner:
                        changed = observation.get("lastPlanAt") != before_planner.get("lastPlanAt") or observation.get("planCount") != before_planner.get("planCount")
                        held = bool(observation.get("lastError")) or not changed
                        blocked = False
                    else:
                        held = (not self.config.get("providerRouting", False)
                                and (not health or health.get("state") in {"held", "error", "failed", "paused"}))
                        changed = current.get("state") != item.get("state") or current.get("updatedAt") != item.get("updatedAt")
                        blocked = current.get("state") == "blocked"
                    status = "complete" if succeeded and not held and changed and not blocked else "held" if succeeded else "failed"
                    emit({"status": status, "unitResult": unit.get("Result"), **observation})
                    return
                STOP.wait(2)
            # Do not remove a live controller's exclusive selection before it exits.
            subprocess.run(["/usr/bin/systemctl", "stop", "--no-block", UNIT], capture_output=True, timeout=15, check=True)
            emit({"status": "failed", "reason": "Bounded controller wait ended; controller stop requested"})
        finally:
            try:
                prior = read_json(self.request_path, {})
                if prior.get("requestId") == own_id:
                    self.request_path.unlink(missing_ok=True)
                with self.mapping_lock:
                    if self.mapping.get("activeRequest", {}).get("requestId") == own_id:
                        self.mapping.pop("activeRequest", None)
                        self.save()
            finally:
                if lock_handle:
                    lock_handle.close()
                self.run_lock.release()


class Handler(socketserver.StreamRequestHandler):
    def handle(self):
        self.request.settimeout(15)
        if not peer_allowed(self.request, self.server.bridge.config["paperclipUid"]):
            self.emit({"status": "error", "reason": "Peer UID denied"})
            return
        try:
            line = self.rfile.readline(MAX_REQUEST + 1)
            if len(line) > MAX_REQUEST or not line.endswith(b"\n"):
                self.emit({"status": "error", "reason": "One bounded JSON line required"})
                return
            self.server.bridge.run(json.loads(line), self.emit)
        except (BrokenPipeError, ConnectionResetError):
            # The controller still owns its unit/lease; requests remain scoped until run exits.
            logging.warning("Paperclip adapter disconnected")
        except Exception:
            logging.exception("Guarded bridge request failed")
            try:
                self.emit({"status": "failed", "reason": "Control-plane request failed; root diagnostic available"})
            except OSError:
                pass

    def emit(self, value):
        if getattr(self, "disconnected", False):
            return
        payload = json.dumps(value, ensure_ascii=True, separators=(",", ":")).encode() + b"\n"
        if len(payload) > MAX_RESPONSE:
            bounded = {key: value[key] for key in ("status", "itemKey", "state", "phase", "role", "sessionId", "unitResult") if key in value}
            bounded["checkpoint"] = clean(value.get("checkpoint", ""), 300)
            payload = json.dumps(bounded, ensure_ascii=True, separators=(",", ":")).encode() + b"\n"
        try:
            self.wfile.write(payload)
            self.wfile.flush()
        except OSError:
            # Keep monitoring the started controller through its terminal state.
            # Disconnecting a process adapter must not release another request.
            self.disconnected = True
            logging.warning("Paperclip adapter disconnected; controller remains supervised")


class Server(socketserver.ThreadingUnixStreamServer):
    daemon_threads = True
    request_queue_size = 16


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default="/etc/orwell-paperclip/bridge.json")
    parser.add_argument("--sync-once", action="store_true")
    parser.add_argument("--no-wake", action="store_true")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    if os.geteuid() != 0:
        raise SystemExit("The bridge must run as root")
    root_private(args.config)
    bridge = Bridge(read_json(args.config))
    for path in (bridge.scope_path, bridge.policy_path):
        root_private(path)
    if args.sync_once:
        bridge.sync(wake=not args.no_wake)
        return
    socket_path = Path(bridge.config.get("socketPath", "/run/orwell-paperclip/control.sock"))
    socket_path.parent.mkdir(mode=0o750, parents=True, exist_ok=True)
    os.chown(socket_path.parent, 0, bridge.config.get("paperclipGid", bridge.config["paperclipUid"]))
    if socket_path.exists():
        # Never displace a live bridge socket on an accidental duplicate start.
        probe = socket.socket(socket.AF_UNIX)
        try:
            probe.connect(str(socket_path))
        except ConnectionRefusedError:
            socket_path.unlink()
        else:
            raise SystemExit("A bridge is already listening")
        finally:
            probe.close()
    with Server(str(socket_path), Handler) as server:
        server.bridge = bridge
        os.chown(socket_path, 0, bridge.config.get("paperclipGid", bridge.config["paperclipUid"]))
        os.chmod(socket_path, 0o660)
        def stop(signum, frame):
            STOP.set()
            threading.Thread(target=server.shutdown, daemon=True).start()
        signal.signal(signal.SIGTERM, stop)
        signal.signal(signal.SIGINT, stop)
        def synchronize():
            while not STOP.is_set():
                try:
                    bridge.sync(wake=not args.no_wake)
                except Exception:
                    logging.exception("Paperclip sync failed; no model invoked by sync")
                STOP.wait(20)
        threading.Thread(target=synchronize, daemon=True).start()
        try:
            server.serve_forever(poll_interval=0.5)
        finally:
            socket_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
