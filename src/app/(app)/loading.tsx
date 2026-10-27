// Esqueleto mientras se verifica la sesión y se cargan los datos de la página.
export default function Cargando() {
  return (
    <div aria-busy="true" aria-label="Cargando" className="animate-pulse">
      <div className="mb-6 h-8 w-48 rounded-md bg-slate-200" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-20 rounded-[var(--radius-tarjeta)] bg-slate-200/70" />)}
      </div>
    </div>
  );
}
