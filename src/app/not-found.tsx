import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold text-[var(--muted-foreground)]">404</h1>
      <p className="mt-4 text-xl text-[var(--foreground)]">
        Página no encontrada
      </p>
      <p className="mt-2 text-[var(--muted-foreground)]">
        El político que buscas no existe en nuestro directorio.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        Volver al directorio
      </Link>
    </div>
  );
}
