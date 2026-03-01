export function Footer() {
  return (
    <footer className="mt-16 border-t border-[var(--border)] bg-[var(--muted)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 text-center text-sm text-[var(--muted-foreground)]">
          <div className="flex items-center gap-2">
            <img
              src="/icons/official/asamblea-nacional.png"
              alt="Asamblea Nacional"
              className="h-6 w-6"
            />
            <span>
              Datos de la{" "}
              <a
                href="https://www.asamblea.gob.pa"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-[var(--foreground)]"
              >
                Asamblea Nacional de Panamá
              </a>
            </span>
          </div>
          <p className="max-w-xl text-xs">
            Este directorio es un proyecto de monitoreo cívico independiente.
            Las cuentas de redes sociales han sido verificadas mediante búsquedas
            públicas y fuentes oficiales.
          </p>
          <p className="text-xs">© {new Date().getFullYear()} ORWELL | POLÍTICA</p>
        </div>
      </div>
    </footer>
  );
}
