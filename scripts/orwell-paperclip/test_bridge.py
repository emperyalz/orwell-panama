"""Isolated control-plane tests. No network, service start, provider or secrets."""
import copy
import json
from pathlib import Path
import socket
import struct
import tempfile
import unittest
from unittest.mock import patch

import bridge

COMPANY = "00000000-0000-4000-8000-000000000001"
AGENTS = {role: f"00000000-0000-4000-8000-00000000000{index}" for index, role in enumerate(("codex", "claude", "orion"), 2)}
KEY = "profile-facts-audit/directory"
ISSUE = "00000000-0000-4000-8000-000000000005"
NOW = 2000000


class FakeHTTP:
    def __init__(self):
        self.calls = []
        self.issues = []
        self.comments = {}
        self.snapshot = {"items": [{"key": KEY, "taskKey": "profile-facts-audit", "stepKey": "directory", "state": "ready", "lead": "Rowan", "updatedAt": 10}], "events": []}
        self.tasks = [{"key": "profile-facts-audit", "title": {"en": "Complete profile facts"}, "status": "doing", "checklist": [{"key": "directory", "label": {"en": "Verify directory"}, "done": False}]}]
        self.health = {"state": "ready"}

    def request(self, url, method="GET", body=None):
        self.calls.append((url, method, copy.deepcopy(body)))
        if url.endswith("/api/query"):
            return {"status": "success", "value": copy.deepcopy({"dispatch:snapshot": self.snapshot, "scoreboard:list": self.tasks, "controllerStatus:snapshot": self.health}[body["path"]])}
        if url.endswith("/wakeup"):
            return {"id": "real-process-wakeup"}
        if url.endswith("/comments"):
            issue_id = url.split("/")[-2]
            if method == "GET":
                return self.comments.get(issue_id, [])
            self.comments.setdefault(issue_id, []).append(copy.deepcopy(body))
            return body
        if method == "GET":
            return copy.deepcopy(self.issues)
        if method == "POST":
            issue = {**body, "id": ISSUE}
            self.issues.append(issue)
            return copy.deepcopy(issue)
        if method == "PATCH":
            for issue in self.issues:
                if url.endswith(issue["id"]):
                    issue.update(body)
            return body
        raise AssertionError((url, method, body))


class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.controller = self.base / "controller"
        self.controller.mkdir()
        bridge.atomic_json(self.controller / "scope.json", {"itemKeys": [KEY]})
        bridge.atomic_json(self.controller / "policy.json", {"startedAt": NOW - 1000, "endsAt": NOW + 3600000,
            "allocationPercentagePoints": 30, "reservePercentagePoints": 3,
            "subscriptionOnly": True, "allowPaidFallback": False})
        bridge.atomic_json(self.controller / "usage.json", {"checks": {"codex": {"allowed": True}, "claude": {"allowed": True}}})
        self.config = {"paperclipUrl": "http://127.0.0.1:3100", "companyId": COMPANY, "agents": dict(AGENTS),
            "paperclipUid": 1002, "controllerStateDirectory": str(self.controller),
            "stateDirectory": str(self.base / "bridge"), "scope": {"itemKeys": [KEY]}, "enableWakeups": True, "assignAgents": True}
        self.http = FakeHTTP()
        self.b = bridge.Bridge(self.config, self.http)
        self.clock = patch("bridge.now_ms", return_value=NOW)
        self.clock.start()
        self.addCleanup(self.clock.stop)

    def reason(self, role="codex"):
        return self.b.eligible(self.http.snapshot["items"][0], self.http.tasks[0], self.http.tasks[0]["checklist"][0],
            role, self.http.snapshot, self.http.health, NOW)

    def mutations(self):
        return [c for c in self.http.calls if c[1] in {"POST", "PATCH"} and not c[0].endswith("/api/query")]

    def test_only_actual_product_tasks_are_mirrored(self):
        allowed = ["profile-facts-audit", "social-identity-audit", "communication-trends", "country-expansion", "social-freshness"]
        rejected = ["agent-live-operations-20261015", "subscription-agent-pilot-20261015", "avatar-editor-controls-20261015",
            "voice-runtime-handoff", "lead-orchestration-accountability", "step-accountability", "orwell-runtime-team-registry"]
        for key in allowed:
            self.assertTrue(bridge.product_task({"key": key}))
        for key in rejected:
            self.assertFalse(bridge.product_task({"key": key}))
        self.assertFalse(bridge.product_task({"key": allowed[0], "status": "superseded"}))

    def test_phase_authorship_and_independent_qa_roles(self):
        self.assertIsNone(self.reason())
        item = self.http.snapshot["items"][0]
        item["state"] = "qa_ready"
        self.assertEqual(bridge.phase_role(item), ("qa", "claude"))
        self.assertIn("Role", self.reason("codex"))
        self.assertIsNone(self.reason("claude"))
        item["state"] = "accept_ready"
        self.assertEqual(bridge.phase_role(item), ("accept", "orion"))
        self.assertIn("Role", self.reason("claude"))

    def test_acceptance_requires_both_original_sources(self):
        step = {"done": False}
        self.assertEqual(bridge.issue_status({"state": "accepted"}, step, True), "blocked")
        self.assertEqual(bridge.issue_status({"state": "qa_ready"}, {"done": True}, True), "blocked")
        self.assertEqual(bridge.issue_status({"state": "accepted"}, {"done": True}, False), "done")
        self.assertEqual(bridge.issue_status({}, {"done": True}, False), "done")

    def test_scope_intersection_cannot_expand_controller(self):
        bridge.atomic_json(self.controller / "scope.json", {"itemKeys": []})
        self.assertIn("scope", self.reason())

    def test_active_lease_anywhere_stops_launch(self):
        self.http.snapshot["items"].append({"key": "other/step", "leaseUntil": NOW + 1})
        self.assertIn("lease", self.reason())

    def test_retry_not_due_stops_launch(self):
        self.http.snapshot["items"][0]["retryAt"] = NOW + 1
        self.assertIn("retry", self.reason())

    def test_held_health_stops_all_roles(self):
        self.http.health["state"] = "held"
        self.assertIn("held", self.reason())
        self.http.health["state"] = "ready"
        bridge.atomic_json(self.controller / "health.json", {"state": "held"})
        self.assertIn("held", self.reason())

    def test_missing_or_denied_subscription_check_fails_closed(self):
        (self.controller / "usage.json").unlink()
        self.assertIn("held", self.reason())
        bridge.atomic_json(self.controller / "usage.json", {"checks": {"codex": {"allowed": True}}})
        self.assertIn("held", self.reason())

    def test_original_deadline_and_allocation_cannot_expand(self):
        path = self.controller / "policy.json"
        original = bridge.read_json(path)
        for field, value in [("endsAt", NOW), ("startedAt", NOW + 1), ("allocationPercentagePoints", 50), ("reservePercentagePoints", 2)]:
            bridge.atomic_json(path, {**original, field: value})
            self.assertIn("held", self.reason())
            self.assertEqual(bridge.read_json(path)[field], value)

    def test_affinity_blocks_other_item(self):
        bridge.atomic_json(self.controller / "affinity.json", {"itemKey": "other/step"})
        self.assertIn("Workspace", self.reason())

    def test_socket_peer_uid_is_kernel_authenticated(self):
        class Peer:
            def __init__(self, uid):
                self.uid = uid
            def getsockopt(self, level, option, size):
                return struct.pack("3i", 999, self.uid, 1002)
        with patch.object(socket, "SO_PEERCRED", 17, create=True):
            self.assertTrue(bridge.peer_allowed(Peer(0), 1002))
            self.assertTrue(bridge.peer_allowed(Peer(1002), 1002))
            self.assertFalse(bridge.peer_allowed(Peer(1001), 1002))

    def test_private_mapping_is_stable_and_import_does_not_wake(self):
        self.b.sync(wake=False)
        first = bridge.read_json(self.b.mapping_path)
        self.http.calls.clear()
        self.b.sync(wake=False)
        self.assertEqual(first, bridge.read_json(self.b.mapping_path))
        self.assertEqual(self.mutations(), [])
        self.assertEqual(self.b.mapping_path.stat().st_mode & 0o777, 0o600)

    def test_qa_reassignment_only_material_patch(self):
        self.b.sync(wake=False)
        self.http.calls.clear()
        self.http.snapshot["items"][0]["state"] = "qa_ready"
        self.b.sync(wake=False)
        patches = [c[2] for c in self.mutations() if c[1] == "PATCH"]
        self.assertEqual(len(patches), 1)
        self.assertEqual(patches[0]["status"], "in_review")
        self.assertEqual(patches[0]["assigneeAgentId"], AGENTS["claude"])
        self.assertIn("Guarded phase owner: claude", patches[0]["description"])

    def test_paperclip_done_cannot_forge_original_acceptance(self):
        self.b.sync(wake=False)
        self.http.issues[0]["status"] = "done"
        self.b.sync(wake=False)
        self.assertEqual(self.http.issues[0]["status"], "todo")
        self.assertFalse(self.http.tasks[0]["checklist"][0]["done"])

    def test_event_comments_recover_crash_dedup(self):
        event = {"itemKey": KEY, "kind": "checkpoint", "actor": "Lin", "at": NOW, "detail": "Observed real Codex session abc"}
        self.http.snapshot["events"] = [event]
        self.b.sync(wake=False)
        self.assertEqual(len(self.http.comments[ISSUE]), 1)
        self.b.mapping["items"][KEY]["eventHashes"] = []
        self.b.sync(wake=False)
        self.assertEqual(len(self.http.comments[ISSUE]), 1)
        self.assertIn(bridge.event_id(event), self.b.mapping["items"][KEY]["eventHashes"])

    def test_explicit_wake_once_per_observed_transition(self):
        self.b.sync()
        self.b.sync()
        wakes = [c for c in self.http.calls if c[0].endswith("/wakeup")]
        self.assertEqual(len(wakes), 1)
        self.assertEqual(wakes[0][2]["payload"], {"orwellIssueId": ISSUE, "orwellItemKey": KEY})
        self.http.snapshot["items"][0].update(state="qa_ready", updatedAt=11)
        self.b.sync()
        wakes = [c for c in self.http.calls if c[0].endswith("/wakeup")]
        self.assertEqual(len(wakes), 2)
        self.assertIn(AGENTS["claude"], wakes[-1][0])

    def test_no_wake_with_held_health(self):
        self.http.health["state"] = "held"
        self.b.sync()
        self.b.sync()
        self.assertFalse(any(c[0].endswith("/wakeup") for c in self.http.calls))

    def test_issue_mapping_resolves_but_wrong_role_noops(self):
        self.b.sync(wake=False)
        item, reason = self.b.resolve(ISSUE, "codex", self.http.snapshot, self.http.tasks, self.http.health)
        self.assertEqual(item["key"], KEY)
        self.assertIsNone(reason)
        self.http.snapshot["items"][0]["state"] = "qa_ready"
        item, reason = self.b.resolve(ISSUE, "codex", self.http.snapshot, self.http.tasks, self.http.health)
        self.assertIsNone(item)
        self.assertIn("Role", reason)

    def test_untrusted_request_cannot_inject_controller_arguments(self):
        messages = []
        with patch.object(self.b, "unit_state", side_effect=AssertionError("must not touch systemd")):
            self.b.run({"role": "codex", "itemKey": "x/y;rm -rf /"}, messages.append)
            self.b.run({"role": "codex", "phase": "accept"}, messages.append)
        self.assertEqual([m["status"] for m in messages], ["error", "error"])

    def test_real_phase_launch_is_scoped_and_clears_own_request(self):
        self.b.sync(wake=False)
        messages = []
        unit = {"ActiveState": "inactive", "Result": "success", "ExecMainStatus": "0"}
        captured = []
        def start(args, **kwargs):
            captured.append((args, bridge.read_json(self.b.request_path)))
            self.http.snapshot["items"][0].update(state="qa_ready", updatedAt=11)
        with patch.object(self.b, "unit_state", return_value=unit), patch("bridge.subprocess.run", side_effect=start), patch("bridge.time.monotonic", side_effect=[0, 1, 3]):
            self.b.run({"role": "codex", "itemKey": ISSUE}, messages.append)
        self.assertEqual(captured[0][0], ["/usr/bin/systemctl", "start", "--no-block", bridge.UNIT])
        self.assertEqual(captured[0][1]["itemKey"], KEY)
        self.assertEqual(captured[0][1]["role"], "codex")
        self.assertIn("requestId", captured[0][1])
        self.assertEqual(messages[-1]["status"], "complete")
        self.assertEqual(messages[-1]["state"], "qa_ready")
        self.assertFalse(self.b.request_path.exists())
        self.assertNotIn("activeRequest", self.b.mapping)

    def test_foreign_request_is_never_cleared(self):
        self.b.sync(wake=False)
        foreign = {"requestId": "root-owned-newer-request", "requestedAt": NOW}
        unit = {"ActiveState": "inactive", "Result": "success", "ExecMainStatus": "0"}
        def start(args, **kwargs):
            bridge.atomic_json(self.b.request_path, foreign)
            self.http.snapshot["items"][0].update(state="qa_ready", updatedAt=11)
        with patch.object(self.b, "unit_state", return_value=unit), patch("bridge.subprocess.run", side_effect=start), patch("bridge.time.monotonic", side_effect=[0, 1, 3]):
            self.b.run({"role": "codex", "itemKey": ISSUE}, lambda x: None)
        self.assertEqual(bridge.read_json(self.b.request_path), foreign)

    def test_restart_recovers_only_own_inactive_request(self):
        self.b.mapping["activeRequest"] = {"requestId": "owned-by-this-bridge"}
        bridge.atomic_json(self.b.request_path, {"requestId": "owned-by-this-bridge", "itemKey": KEY})
        with patch.object(self.b, "unit_state", return_value={"ActiveState": "active"}):
            self.b.recover_request()
        self.assertTrue(self.b.request_path.exists())
        with patch.object(self.b, "unit_state", return_value={"ActiveState": "inactive"}):
            self.b.recover_request()
        self.assertFalse(self.b.request_path.exists())
        self.assertNotIn("activeRequest", self.b.mapping)

    def test_role_only_adapter_uses_specific_pending_wake(self):
        self.b.sync()
        self.http.snapshot["items"][0]["state"] = "qa_ready"
        item, reason = self.b.resolve(None, "codex", self.http.snapshot, self.http.tasks, self.http.health)
        self.assertIsNone(item)
        self.assertEqual(reason, "No eligible product step for this role")
        self.assertEqual(len([c for c in self.http.calls if c[0].endswith("/wakeup")]), 1)

    def test_board_managed_mirror_has_owner_without_implicit_agent_wakes(self):
        self.b.config["assignAgents"] = False
        self.b.sync(wake=False)
        issue = self.http.issues[0]
        self.assertIsNone(issue["assigneeAgentId"])
        self.assertEqual(issue["assigneeUserId"], "local-board")
        self.assertIn("Guarded phase owner: codex", issue["description"])
        self.assertFalse(any(c[0].endswith("/wakeup") for c in self.http.calls))

    def test_active_board_managed_issue_retains_valid_owner(self):
        self.b.config["assignAgents"] = False
        self.b.config["boardUserId"] = "configured-board-user"
        self.http.snapshot["items"][0]["state"] = "running"
        self.b.sync(wake=False)
        issue = self.http.issues[0]
        self.assertEqual(issue["status"], "in_progress")
        self.assertIsNone(issue["assigneeAgentId"])
        self.assertEqual(issue["assigneeUserId"], "configured-board-user")
        self.assertIn("Guarded phase owner: codex", issue["description"])

    def test_agent_assignment_clears_board_owner(self):
        self.b.sync(wake=False)
        self.http.issues[0]["assigneeUserId"] = "local-board"
        self.b.sync(wake=False)
        self.assertIsNone(self.http.issues[0]["assigneeUserId"])
        self.assertEqual(self.http.issues[0]["assigneeAgentId"], AGENTS["codex"])

    def test_pending_wake_prevents_mass_import_parallel_runs(self):
        other = copy.deepcopy(self.http.snapshot["items"][0])
        other.update(key="social-identity-audit/missing", taskKey="social-identity-audit", stepKey="missing", taskOrder=-10)
        task = {"key": "social-identity-audit", "title": {"en": "Audit identities"}, "status": "todo",
                "checklist": [{"key": "missing", "label": {"en": "Check missing"}, "done": False}]}
        self.http.tasks.append(task)
        self.http.snapshot["items"].append(other)
        self.b.config["scope"]["itemKeys"].append(other["key"])
        bridge.atomic_json(self.controller / "scope.json", {"itemKeys": [KEY, other["key"]]})
        # Avoid multiple fake issue IDs while exercising actual wake selection.
        self.b.mapping["items"] = {KEY: {"issueId": ISSUE}, other["key"]: {"issueId": COMPANY}}
        self.b.config["priorityItemKeys"] = [KEY, other["key"]]
        self.b.wake_ready(self.http.snapshot, self.http.tasks, self.http.health)
        self.b.wake_ready(self.http.snapshot, self.http.tasks, self.http.health)
        wakes = [c for c in self.http.calls if c[0].endswith("/wakeup")]
        self.assertEqual(len(wakes), 1)
        self.assertEqual(wakes[0][2]["payload"]["orwellItemKey"], KEY)

    def test_historical_completion_label_preserves_original_history(self):
        self.http.snapshot["items"] = []
        self.http.tasks[0]["checklist"][0]["done"] = True
        self.b.sync(wake=False)
        self.assertEqual(self.http.issues[0]["status"], "done")
        self.assertIn("Historical recorded completion, no new controller acceptance", self.http.issues[0]["description"])

    def test_blocked_transition_meets_paperclip_unblock_contract_and_clears_on_ready(self):
        self.b.sync(wake=False)
        self.http.calls.clear()
        self.http.snapshot["items"][0].update(state="blocked", blockedReason="Independent QA found an uncovered selected month", nextAction="Repair the selected-month coverage condition and repeat independent QA")
        self.b.sync(wake=False)
        issue = self.http.issues[0]
        self.assertEqual(issue["status"], "blocked")
        self.assertEqual(issue["unblockDescriptor"], {"owner": "board", "action": "Repair the selected-month coverage condition and repeat independent QA"})
        self.http.snapshot["items"][0].update(state="ready")
        self.http.calls.clear()
        self.b.sync(wake=False)
        patch = next(call[2] for call in self.http.calls if call[1] == "PATCH")
        self.assertEqual(patch["status"], "todo")
        self.assertIsNone(patch["unblockDescriptor"])

    def test_blocked_descriptor_is_bounded_sanitized_and_reconciles_fact_mismatch(self):
        descriptor = bridge.unblock_descriptor({"state": "blocked", "blockedReason": "api_key=private " + "x" * 3000}, {"done": False}, "blocked")
        self.assertEqual(descriptor["owner"], "board")
        self.assertLessEqual(len(descriptor["action"]), 2000)
        self.assertNotIn("private", descriptor["action"])
        descriptor = bridge.unblock_descriptor({"state": "accepted"}, {"done": False}, "blocked")
        self.assertIn("Reconcile", descriptor["action"])

    def test_observations_redact_and_never_serialize_config(self):
        self.http.snapshot["items"][0]["checkpoint"] = "Authorization=abc api_key=secret Bearer hiddenvalue"
        observation = self.b.observed(self.http.snapshot["items"][0], self.http.snapshot)
        text = json.dumps(observation)
        self.assertNotIn("secret", text)
        self.assertNotIn("hiddenvalue", text)
        self.assertNotIn("paperclipUid", text)

    def dynamic_route(self, phase="work", role="claude", allowed=True):
        self.b.config["providerRouting"] = True
        route = {"observedAt": NOW, "items": {KEY: {"phase": phase, "role": role, "allowed": allowed, "reason": "Native admission observed"}}}
        bridge.atomic_json(self.b.routing_path, route)
        return route

    def planner_setup(self):
        self.b.config["agents"]["planner"] = "00000000-0000-4000-8000-000000000006"
        self.b.config.update(providerRouting=True, enablePlanningWakeups=True)
        bridge.atomic_json(self.controller / "scope.json", {"serverPlanning": True, "itemKeys": []})
        self.http.snapshot["items"][0]["state"] = "accepted"
        self.http.tasks[0]["checklist"][0]["done"] = True
        planner = {"state": "ready", "nextPlanAt": NOW, "lastPlanAt": NOW - 1800001,
                   "lastBacklogHash": "backlog-42", "backlogHash": "backlog-42", "planningAllowed": True, "planCount": 1}
        bridge.atomic_json(self.b.planner_path, planner)
        bridge.atomic_json(self.b.routing_path, {"observedAt": NOW, "items": {}, "planner": {"allowed": True, "role": "claude"}})
        return planner

    def test_root_can_route_work_to_claude(self):
        self.dynamic_route(role="claude")
        self.assertIsNone(self.reason("claude"))
        self.assertIn("Role", self.reason("codex"))
        self.b.sync(wake=False)
        self.assertIn("Guarded phase owner: claude", self.http.issues[0]["description"])

    def test_dynamic_qa_requires_opposite_actual_author(self):
        self.http.snapshot["items"][0].update(state="qa_ready", workerProvider="claude")
        self.dynamic_route(phase="qa", role="codex")
        self.assertIsNone(self.reason("codex"))
        self.dynamic_route(phase="qa", role="claude")
        self.assertIn("Independent QA", self.reason("claude"))
        self.http.snapshot["items"][0].pop("workerProvider")
        self.dynamic_route(phase="qa", role="codex")
        self.assertIn("Independent QA", self.reason("codex"))

    def test_claude_cross_model_qa_requires_explicit_root_scope_and_known_profiles(self):
        item = self.http.snapshot["items"][0]
        item.update(state="qa_ready", workerProvider="claude", workerModel="sonnet")
        route = self.dynamic_route(phase="qa", role="claude")
        route["items"][KEY]["model"] = "opus"
        bridge.atomic_json(self.b.routing_path, route)
        self.assertIn("Independent QA", self.reason("claude"))
        bridge.atomic_json(self.b.scope_path, {"itemKeys": [KEY], "reviewMode": "claude-cross-model"})
        self.assertIsNone(self.reason("claude"))
        route["items"][KEY]["model"] = "claude-sonnet-4-6"
        bridge.atomic_json(self.b.routing_path, route)
        self.assertIn("Independent QA", self.reason("claude"))
        route["items"][KEY]["model"] = "unknown"
        bridge.atomic_json(self.b.routing_path, route)
        self.assertIn("Independent QA", self.reason("claude"))
        route["items"][KEY].pop("model")
        bridge.atomic_json(self.b.routing_path, route)
        self.assertIsNone(self.reason("claude"))
        item["workerModel"] = "haiku"
        self.assertIn("Independent QA", self.reason("claude"))

    def test_qa_does_not_require_exhausted_author_provider(self):
        self.http.snapshot["items"][0].update(state="qa_ready", workerProvider="codex")
        self.dynamic_route(phase="qa", role="claude")
        self.http.health["state"] = "held"
        bridge.atomic_json(self.controller / "health.json", {"state": "held"})
        bridge.atomic_json(self.b.usage_path, {"checks": {"codex": {"allowed": False}, "claude": {"allowed": True}}})
        self.assertIsNone(self.reason("claude"))

    def test_dynamic_routes_fail_closed_missing_stale_denied_or_phase_changed(self):
        self.b.config["providerRouting"] = True
        self.assertIn("held", self.reason("claude"))
        route = self.dynamic_route()
        route["observedAt"] = NOW - 120001
        bridge.atomic_json(self.b.routing_path, route)
        self.assertIn("held", self.reason("claude"))
        self.dynamic_route(allowed=False)
        self.assertIn("held", self.reason("claude"))
        self.dynamic_route(phase="qa")
        self.assertIn("held", self.reason("claude"))

    def test_dynamic_provider_material_change_creates_new_wake(self):
        self.dynamic_route(role="codex")
        self.b.sync()
        self.dynamic_route(role="claude")
        self.b.sync()
        wakes = [call for call in self.http.calls if call[0].endswith("/wakeup")]
        self.assertEqual(len(wakes), 2)
        self.assertIn(AGENTS["codex"], wakes[0][0])
        self.assertIn(AGENTS["claude"], wakes[1][0])
        self.assertNotEqual(wakes[0][2]["idempotencyKey"], wakes[1][2]["idempotencyKey"])

    def test_follow_root_planned_scope_requires_explicit_authorization(self):
        self.b.config["followControllerScope"] = True
        with self.assertRaises(ValueError):
            self.b.scope()
        bridge.atomic_json(self.b.scope_path, {"serverPlanning": True, "itemKeys": ["social-identity-audit/missing"]})
        self.assertEqual(self.b.scope(), {"social-identity-audit/missing"})

    def test_real_parallel_preparation_links_task_without_acceptance_or_wake(self):
        bridge.atomic_json(self.b.controller / "parallel-preparation.json", {"state": "preparation_running", "batchId": "actual-batch",
            "jobs": [{"itemKey": KEY, "positionKey": "position:research-02"}], "productAccepted": False})
        self.b.sync()
        self.assertEqual(self.http.issues[0]["status"], "in_progress")
        self.assertIn("position:research-02", self.http.issues[0]["description"])
        self.assertIn("no product implementation or checkbox acceptance", self.http.issues[0]["description"])
        self.assertFalse(any(c[0].endswith("/wakeup") for c in self.http.calls))
        self.assertFalse(self.http.tasks[0]["checklist"][0]["done"])

    def test_real_blocker_remains_visible_outside_execution_scope(self):
        self.assertEqual(bridge.issue_status({"state": "blocked"}, {"done": False}, False), "blocked")

    def test_authoritatively_superseded_task_cancels_stale_mirror(self):
        self.b.sync(wake=False)
        self.http.tasks[0]["status"] = "superseded"
        self.b.sync(wake=False)
        self.assertEqual(self.http.issues[0]["status"], "cancelled")

    def test_linked_product_wake_assigns_before_reserved_issue_id(self):
        self.b.config.update(assignAgents=False, linkExplicitWakes=True)
        self.b.sync()
        wake = next(c for c in self.http.calls if c[0].endswith("/wakeup"))
        self.assertEqual(wake[2]["payload"]["issueId"], ISSUE)
        assignment = next(c for c in self.http.calls if c[1] == "PATCH" and c[2].get("assigneeAgentId") == AGENTS["codex"])
        self.assertEqual(assignment[2]["status"], "backlog")
        self.assertLess(self.http.calls.index(assignment), self.http.calls.index(wake))
        self.b.sync(wake=False)
        self.assertEqual(self.http.issues[0]["assigneeAgentId"], AGENTS["codex"])

    def test_linked_planner_issue_reports_actual_failure_without_product_completion(self):
        self.planner_setup()
        self.b.config["linkExplicitWakes"] = True
        state = bridge.read_json(self.b.planner_path)
        bridge.atomic_json(self.b.planner_path, {**state, "state": "held", "lastError": "Path outside trusted inventory",
            "lastSessionId": "actual-native-session", "lastModel": "sonnet"})
        issue_id = self.b.sync_planner_issue()
        issue = self.http.issues[-1]
        self.assertEqual(issue["status"], "blocked")
        self.assertIn("actual-native-session", issue["description"])
        self.assertIn("sonnet", issue["description"])
        self.assertIn("Path outside", issue["unblockDescriptor"]["action"])
        self.assertEqual(self.b.mapping["plannerIssueId"], issue_id)

    def test_planner_wakes_once_and_idle_polls_do_not_infer(self):
        self.planner_setup()
        self.b.sync()
        self.b.sync()
        wakes = [call for call in self.http.calls if call[0].endswith("/wakeup")]
        self.assertEqual(len(wakes), 1)
        self.assertIn(self.b.config["agents"]["planner"], wakes[0][0])
        self.assertEqual(wakes[0][2]["reason"], "orwell_server_planning_ready")
        self.assertNotIn("issueId", wakes[0][2]["payload"])

    def test_planner_requires_root_scope_state_route_and_deadline(self):
        planner = self.planner_setup()
        self.assertIsNone(self.b.planner_reason(self.http.snapshot, self.http.tasks, self.http.health))
        for field, value in [("planningAllowed", False), ("state", "planning"), ("state", "held"), ("nextPlanAt", NOW + 1)]:
            bridge.atomic_json(self.b.planner_path, {**planner, field: value})
            self.assertIsNotNone(self.b.planner_reason(self.http.snapshot, self.http.tasks, self.http.health))
        bridge.atomic_json(self.b.planner_path, planner)
        route = bridge.read_json(self.b.routing_path)
        bridge.atomic_json(self.b.routing_path, {**route, "observedAt": NOW - 120001})
        self.assertIn("held", self.b.planner_reason(self.http.snapshot, self.http.tasks, self.http.health))
        bridge.atomic_json(self.b.routing_path, route)
        policy = bridge.read_json(self.b.policy_path)
        bridge.atomic_json(self.b.policy_path, {**policy, "endsAt": NOW})
        self.assertIn("held", self.b.planner_reason(self.http.snapshot, self.http.tasks, self.http.health))

    def test_planner_cooldown_only_material_backlog_change_can_bypass(self):
        planner = self.planner_setup()
        planner["lastPlanAt"] = NOW - 1000
        bridge.atomic_json(self.b.planner_path, planner)
        self.assertIn("cooldown", self.b.planner_reason(self.http.snapshot, self.http.tasks, self.http.health))
        planner["backlogHash"] = "material-new-product-backlog"
        bridge.atomic_json(self.b.planner_path, planner)
        self.assertIsNone(self.b.planner_reason(self.http.snapshot, self.http.tasks, self.http.health))

    def test_planner_daily_limit_cannot_expand_above_twenty_four(self):
        self.planner_setup()
        self.b.config["maxPlansPerDay"] = 500
        self.b.mapping["plannerDaily"] = {"day": "1970-01-01", "count": 24}
        self.assertIn("daily limit", self.b.planner_reason(self.http.snapshot, self.http.tasks, self.http.health))

    def test_planner_does_not_replace_eligible_product_phase(self):
        self.planner_setup()
        bridge.atomic_json(self.b.scope_path, {"serverPlanning": True, "itemKeys": [KEY]})
        self.http.snapshot["items"][0].update(state="ready")
        self.http.tasks[0]["checklist"][0]["done"] = False
        route = self.dynamic_route(role="claude")
        route["planner"] = {"allowed": True, "role": "claude"}
        bridge.atomic_json(self.b.routing_path, route)
        self.assertIn("already eligible", self.b.planner_reason(self.http.snapshot, self.http.tasks, self.http.health))

    def test_planner_request_has_no_product_key_and_streams_actual_state(self):
        self.planner_setup()
        self.b.sync()
        messages, captured = [], []
        unit = {"ActiveState": "inactive", "Result": "success", "ExecMainStatus": "0"}
        def start(args, **kwargs):
            captured.append(bridge.read_json(self.b.request_path))
            state = bridge.read_json(self.b.planner_path)
            bridge.atomic_json(self.b.planner_path, {**state, "state": "idle", "lastPlanAt": NOW, "planCount": 2})
        with patch.object(self.b, "unit_state", return_value=unit), patch("bridge.subprocess.run", side_effect=start), patch("bridge.time.monotonic", side_effect=[0, 1, 3]):
            self.b.run({"role": "planner"}, messages.append)
        self.assertEqual(captured[0]["role"], "planner")
        self.assertNotIn("itemKey", captured[0])
        self.assertEqual(messages[-1]["status"], "complete")
        self.assertEqual(messages[-1]["planCount"], 2)
        self.assertFalse(self.b.request_path.exists())

    def test_manual_planner_cannot_bypass_pending_wake_daily_guard(self):
        self.planner_setup()
        unit = {"ActiveState": "inactive"}
        messages = []
        with patch.object(self.b, "unit_state", return_value=unit), patch("bridge.subprocess.run", side_effect=AssertionError("no controller start")):
            self.b.run({"role": "planner"}, messages.append)
        self.assertEqual(messages[-1]["status"], "noop")
        self.assertIn("trusted planner wake", messages[-1]["reason"])

    def test_meter_tick_race_waits_without_losing_the_pending_wake(self):
        self.planner_setup()
        self.b.sync()
        messages = []
        idle = {"ActiveState": "inactive", "Result": "success", "ExecMainStatus": "0"}
        states = iter([{"ActiveState": "activating"}, idle, idle])
        def start(*args, **kwargs):
            state = bridge.read_json(self.b.planner_path)
            bridge.atomic_json(self.b.planner_path, {**state, "state": "held", "lastError": None, "lastPlanAt": NOW, "planCount": 2})
        with patch.object(self.b, "unit_state", side_effect=lambda: next(states, idle)), patch.object(bridge.STOP, "wait", return_value=False) as wait, patch("bridge.subprocess.run", side_effect=start), patch("bridge.time.monotonic", side_effect=[0, 1, 3]):
            self.b.run({"role": "planner"}, messages.append)
        wait.assert_called_once_with(1)
        self.assertEqual(messages[-1]["status"], "complete")
        self.assertEqual(messages[-1]["state"], "held")


if __name__ == "__main__":
    unittest.main()
