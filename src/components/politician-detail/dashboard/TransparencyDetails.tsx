"use client";

interface TransparencyDocument {
  cvUrl?: string;
  propuestaPoliticaUrl?: string;
  declaracionInteresesUrl?: string;
  declaracionPatrimonioUrl?: string;
}

interface TransparencyDetailsProps {
  suplente?: string;
  planillaTotal?: string;
  biography?: string;
  documents?: TransparencyDocument;
  voluntaryDeclarations?: boolean;
}

function DocLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  // Filter out placeholder URLs
  if (!href || href.endsWith("1") || href.endsWith("/1")) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]"
    >
      <span>{icon}</span>
      <span>{label}</span>
      <span className="text-[var(--muted-foreground)]">↗</span>
    </a>
  );
}

export function TransparencyDetails({
  suplente,
  planillaTotal,
  biography,
  documents,
  voluntaryDeclarations,
}: TransparencyDetailsProps) {
  const hasDocuments =
    documents &&
    (documents.cvUrl ||
      documents.propuestaPoliticaUrl ||
      documents.declaracionInteresesUrl ||
      documents.declaracionPatrimonioUrl);

  return (
    <div className="space-y-4">
      {/* Suplente + Planilla row */}
      {(suplente || planillaTotal) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {suplente && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                Suplente
              </p>
              <p className="text-sm font-medium text-[var(--foreground)]">
                {suplente}
              </p>
            </div>
          )}
          {planillaTotal && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                Planilla (Nómina)
              </p>
              <p className="text-lg font-bold text-[var(--foreground)]">
                {planillaTotal}
              </p>
              {voluntaryDeclarations && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600">
                  ✓ Declaración Voluntaria
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Documents */}
      {hasDocuments && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
            Documentos Públicos
          </p>
          <div className="flex flex-wrap gap-2">
            {documents?.cvUrl && (
              <DocLink href={documents.cvUrl} label="CV" icon="📄" />
            )}
            {documents?.propuestaPoliticaUrl && (
              <DocLink
                href={documents.propuestaPoliticaUrl}
                label="Propuesta Política"
                icon="📋"
              />
            )}
            {documents?.declaracionInteresesUrl && (
              <DocLink
                href={documents.declaracionInteresesUrl}
                label="Declaración de Intereses"
                icon="📊"
              />
            )}
            {documents?.declaracionPatrimonioUrl && (
              <DocLink
                href={documents.declaracionPatrimonioUrl}
                label="Declaración Patrimonial"
                icon="💰"
              />
            )}
          </div>
        </div>
      )}

      {/* Biography */}
      {biography && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
            Biografía
          </p>
          <p className="text-sm leading-relaxed text-[var(--card-foreground)]">
            {biography}
          </p>
        </div>
      )}
    </div>
  );
}
