"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { useSession } from "next-auth/react";
import { ExternalLink, Plus, Trash2, UploadCloud } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { usePortraitReview } from "@/hooks/usePortraitReview";
import { ImageUpload } from "@/components/admin/ImageUpload";
import approvedMasters from "@/data/approved-fullbody-portraits.json";

type Props = {
  externalId: string;
  politicianId: Id<"politicians">;
  headshot: string;
  fullBodyPortrait?: string;
};

export function PortraitWorkspace({ externalId, politicianId, headshot, fullBodyPortrait }: Props) {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const canEdit = !!role && ["king_admin", "admin", "editor"].includes(role);
  const ids = useMemo(() => [externalId], [externalId]);
  const { references, upload, remove } = usePortraitReview(ids);
  const storeHeadshot = useMutation(api.storage.storeHeadshot);
  const storeFullBody = useMutation(api.storage.storeFullBodyPortrait);
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const master = fullBodyPortrait || approvedMasters[externalId as keyof typeof approvedMasters];
  const rows = references?.filter((row) => row.externalId === externalId) ?? [];

  async function addFiles(files: FileList | File[]) {
    if (!canEdit || busy) return;
    const items = Array.from(files);
    if (!items.length) return;
    setBusy(true);
    setError("");
    const failures: string[] = [];
    for (const file of items) {
      try { await upload(externalId, file); }
      catch (cause) { failures.push(cause instanceof Error ? cause.message : file.name); }
    }
    setError(failures.join(" · "));
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  async function deleteReference(id: Id<"portraitReviewReferences">) {
    try { await remove(id); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo eliminar la foto"); }
  }

  return <section className="space-y-5 rounded-xl border border-[var(--border)] bg-[var(--background)] p-4" aria-labelledby="portrait-workspace-title">
    <div>
      <h2 id="portrait-workspace-title" className="text-sm font-semibold text-[var(--foreground)]">Retratos y referencias</h2>
      <p className="mt-1 text-xs text-[var(--muted-foreground)]">El recorte se muestra en el perfil público. El retrato completo se conserva como original para futuras versiones.</p>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
        <div className="aspect-[24/25] max-h-64 overflow-hidden rounded-md bg-[var(--muted)]">
          {headshot ? <img src={headshot} alt="Retrato recortado del perfil" className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-xs text-[var(--muted-foreground)]">Sin recorte</div>}
        </div>
        <ImageUpload currentImageUrl={headshot} label="Foto del perfil · recorte" onUploaded={async (storageId) => {
          await storeHeadshot({ politicianId, storageId: storageId as Id<"_storage"> });
        }} />
      </div>
      <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
        <div className="aspect-[2/3] max-h-64 overflow-hidden rounded-md bg-[var(--muted)]">
          {master ? <img src={master} alt="Retrato de cuerpo completo" className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-xs text-[var(--muted-foreground)]">Aún no hay retrato completo</div>}
        </div>
        {master && <a href={master} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--foreground)] underline">Abrir original <ExternalLink className="h-3 w-3" /></a>}
        <ImageUpload currentImageUrl={master} label="Original · cuerpo completo" onUploaded={async (storageId) => {
          await storeFullBody({ politicianId, storageId: storageId as Id<"_storage"> });
        }} />
      </div>
    </div>
    <div>
      <h3 className="text-xs font-semibold text-[var(--foreground)]">Fotos de inspiración ({rows.length})</h3>
      <p className="mt-1 text-xs text-[var(--muted-foreground)]">Añade referencias para próximas generaciones. Estas fotos no cambian la imagen pública.</p>
      <div
        className={`relative mt-3 rounded-lg border-2 border-dashed p-4 ${dragging ? "border-violet-600 bg-violet-50" : "border-[var(--border)]"}`}
        onDragEnter={(event) => { if (canEdit) { event.preventDefault(); setDragging(true); } }}
        onDragOver={(event) => { if (canEdit) event.preventDefault(); }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
        onDrop={(event) => { if (!canEdit) return; event.preventDefault(); setDragging(false); void addFiles(event.dataTransfer.files); }}
      >
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden onChange={(event) => { if (event.target.files) void addFiles(event.target.files); }} />
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--muted-foreground)]">
          <span className="flex items-center gap-2"><UploadCloud className="h-4 w-4" />{busy ? "Subiendo fotos…" : "Arrastra fotos aquí · JPG, PNG, WebP o AVIF · máximo 8 MB cada una"}</span>
          {canEdit && <button type="button" disabled={busy} onClick={() => input.current?.click()} className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-3 py-2 font-semibold text-[var(--foreground)] disabled:opacity-50"><Plus className="h-3.5 w-3.5" /> Añadir fotos</button>}
        </div>
        {rows.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {rows.map((row) => <figure key={row._id} className="min-w-0 rounded-md border border-[var(--border)] p-2">
            {row.imageUrl && <a href={row.sourcePage || row.imageUrl} target="_blank" rel="noreferrer"><img data-no-translate src={row.imageUrl} alt={row.title} referrerPolicy="no-referrer" className="aspect-square w-full rounded object-cover" /></a>}
            <figcaption className="mt-2 flex items-start justify-between gap-2 text-[11px] text-[var(--muted-foreground)]"><span data-no-translate className="min-w-0 truncate" title={row.title}>{row.title}</span>{canEdit && <button type="button" onClick={() => void deleteReference(row._id)} aria-label={`Eliminar ${row.title}`} className="shrink-0 text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>}</figcaption>
          </figure>)}
        </div>}
        {error && <p role="alert" className="mt-3 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  </section>;
}
