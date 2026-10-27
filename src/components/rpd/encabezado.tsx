// Título de página: Poppins 600, 28 px (11.1).
export function Encabezado({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-[22px] font-semibold text-ink md:text-[28px]">{titulo}</h1>
        {descripcion && <p className="mt-1 text-sm text-ink-muted">{descripcion}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </header>
  );
}
