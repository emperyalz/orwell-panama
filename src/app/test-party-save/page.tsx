"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export default function TestPartySavePage() {
  const party = useQuery(api.parties.getByCode, { code: "PRD" });
  const updateParty = useMutation(api.parties.update);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<string[]>([]);

  const log = (msg: string) => {
    console.log("[TEST]", msg);
    setLogs((prev) => [...prev, `${new Date().toISOString().slice(11, 23)} ${msg}`]);
  };

  if (!party) {
    return <div style={{ padding: 40, fontFamily: "monospace" }}>Loading party data...</div>;
  }

  const getFieldValue = (field: string) => {
    if (field in form) return form[field];
    return (party as any)[field] ?? "";
  };

  const setField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
    log(`setField("${field}", "${value}")`);
  };

  async function handleSave() {
    log("handleSave() start");
    setSaving(true);
    setSaveError(null);
    try {
      const updates: Record<string, any> = {};
      for (const [key, value] of Object.entries(form)) {
        if (value !== (party as any)[key]) {
          updates[key] = value;
        }
      }
      log(`updates: ${JSON.stringify(updates)}`);

      if (Object.keys(updates).length > 0) {
        log("calling updateParty...");
        await updateParty({
          id: party!._id as Id<"parties">,
          ...updates,
        });
        log("updateParty succeeded");
      } else {
        log("no changes to save");
      }
      setSaved(true);
      log("setSaved(true)");
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      log(`ERROR: ${err?.message}`);
      console.error("Save failed:", err);
      setSaveError(err?.message ?? "Failed to save changes");
    } finally {
      setSaving(false);
      log("handleSave() done");
    }
  }

  return (
    <div style={{ padding: 40, fontFamily: "monospace", maxWidth: 600 }}>
      <h1 style={{ fontSize: 18, fontWeight: "bold" }}>Test Party Save — {party.code}</h1>
      <p style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
        ID: {party._id} | Color: {party.color} | Secondary: {party.secondaryColor ?? "none"}
      </p>

      {saveError && (
        <div style={{ marginTop: 16, padding: 12, background: "#fee", border: "1px solid #f00", borderRadius: 8, fontSize: 12 }}>
          <strong>Error:</strong> {saveError}
        </div>
      )}

      <div style={{ marginTop: 20, display: "flex", gap: 12, alignItems: "center" }}>
        <label style={{ fontSize: 12 }}>Primary Color:</label>
        <input
          value={getFieldValue("color")}
          onChange={(e) => setField("color", e.target.value)}
          style={{ border: "1px solid #ccc", padding: "4px 8px", fontSize: 12, width: 100 }}
        />
        <input
          type="color"
          value={getFieldValue("color") || "#888888"}
          onChange={(e) => setField("color", e.target.value)}
          style={{ width: 40, height: 30 }}
        />
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
        <label style={{ fontSize: 12 }}>Secondary Color:</label>
        <input
          value={getFieldValue("secondaryColor")}
          onChange={(e) => setField("secondaryColor", e.target.value)}
          style={{ border: "1px solid #ccc", padding: "4px 8px", fontSize: 12, width: 100 }}
        />
        <input
          type="color"
          value={getFieldValue("secondaryColor") || getFieldValue("color") || "#888888"}
          onChange={(e) => setField("secondaryColor", e.target.value)}
          style={{ width: 40, height: 30 }}
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          marginTop: 16,
          padding: "8px 20px",
          background: saving ? "#999" : "#000",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: saving ? "not-allowed" : "pointer",
          fontSize: 13,
        }}
      >
        {saving ? "Saving..." : saved ? "Saved ✓" : "Save Changes"}
      </button>

      <div style={{ marginTop: 20, fontSize: 11, color: "#666" }}>
        <strong>Live party data from Convex:</strong>
        <pre style={{ background: "#f5f5f5", padding: 12, borderRadius: 6, overflow: "auto", marginTop: 4 }}>
          {JSON.stringify(party, null, 2)}
        </pre>
      </div>

      <div style={{ marginTop: 16, fontSize: 11, color: "#666" }}>
        <strong>Logs:</strong>
        <pre style={{ background: "#f0f0f0", padding: 12, borderRadius: 6, maxHeight: 200, overflow: "auto", marginTop: 4 }}>
          {logs.length === 0 ? "(no actions yet)" : logs.join("\n")}
        </pre>
      </div>
    </div>
  );
}
