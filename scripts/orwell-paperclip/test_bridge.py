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
        self.config = {"paperclipUrl": "http://127.0.0.1:3100", "companyId": COMPANY, "agents": AGENTS,
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

    def test_observations_redact_and_never_serialize_config(self):
        self.http.snapshot["items"][0]["checkpoint"] = "Authorization=abc api_key=secret Bearer hiddenvalue"
        observation = self.b.observed(self.http.snapshot["items"][0], self.http.snapshot)
        text = json.dumps(observation)
        self.assertNotIn("secret", text)
        self.assertNotIn("hiddenvalue", text)
        self.assertNotIn("paperclipUid", text)


if __name__ == "__main__":
    unittest.main()
