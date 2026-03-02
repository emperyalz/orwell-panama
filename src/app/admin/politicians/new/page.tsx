"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { CustomSelect } from "@/components/ui/CustomSelect";

const ROLE_CATEGORIES = ["Deputy", "Mayor", "Governor", "President"] as const;

export default function NewPoliticianPage() {
  const router = useRouter();
  const createPolitician = useMutation(api.politicians.create);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    externalId: "",
    name: "",
    slug: "",
    party: "",
    partyFull: "",
    role: "",
    roleCategory: "Deputy" as string,
    province: "",
    district: "",
    circuit: "",
    officialGovUrl: "",
  });

  const setField = (field: string, value: string) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      // Auto-generate slug from name
      if (field === "name") {
        updated.slug = value
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
      }
      return updated;
    });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.externalId || !form.name || !form.party || !form.role) return;

    setSaving(true);
    try {
      await createPolitician({
        externalId: form.externalId,
        name: form.name,
        slug: form.slug,
        party: form.party,
        partyFull: form.partyFull,
        role: form.role,
        roleCategory: form.roleCategory as any,
        province: form.province,
        district: form.district || undefined,
        circuit: form.circuit || undefined,
        hasHeadshot: false,
        headshot: `/images/headshots/${form.externalId}.jpg`,
        officialGovUrl: form.officialGovUrl || undefined,
      });
      router.push("/admin/politicians");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/politicians"
          className="rounded-lg border border-[var(--border)] p-2 text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold text-[var(--foreground)]">
          Add New Politician
        </h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 space-y-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              External ID *
            </label>
            <input
              value={form.externalId}
              onChange={(e) => setField("externalId", e.target.value)}
              placeholder="DEP-999"
              required
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Name *
            </label>
            <input
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="Full Name"
              required
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Slug
            </label>
            <input
              value={form.slug}
              onChange={(e) => setField("slug", e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--muted-foreground)] focus:border-[var(--foreground)] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Party Code *
            </label>
            <input
              value={form.party}
              onChange={(e) => setField("party", e.target.value)}
              placeholder="PRD"
              required
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Party Full Name
            </label>
            <input
              value={form.partyFull}
              onChange={(e) => setField("partyFull", e.target.value)}
              placeholder="Partido Revolucionario Democrático"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Role *
            </label>
            <input
              value={form.role}
              onChange={(e) => setField("role", e.target.value)}
              placeholder="Diputado"
              required
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Role Category
            </label>
            <CustomSelect
              value={form.roleCategory}
              onChange={(v) => setField("roleCategory", v)}
              options={ROLE_CATEGORIES.map((rc) => ({ value: rc, label: rc }))}
              size="default"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Province
            </label>
            <input
              value={form.province}
              onChange={(e) => setField("province", e.target.value)}
              placeholder="Panamá"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              District
            </label>
            <input
              value={form.district}
              onChange={(e) => setField("district", e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Circuit
            </label>
            <input
              value={form.circuit}
              onChange={(e) => setField("circuit", e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Official Gov URL
            </label>
            <input
              value={form.officialGovUrl}
              onChange={(e) => setField("officialGovUrl", e.target.value)}
              placeholder="https://www.asamblea.gob.pa/..."
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={saving || !form.externalId || !form.name}
            className="flex items-center gap-2 rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Creating..." : "Create Politician"}
          </button>
          <Link
            href="/admin/politicians"
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
