// Orden de la lista de Prospectos «por fecha para retirar»: primero los que ya pueden retirar (el que lleva más
// tiempo esperando arriba), luego los que les faltan días (de menos a más) y al final los que no tienen fecha
// de baja u otro servicio (el alta más reciente arriba). Pura: recibe `hoy`.
import type { FechaISO } from "./fechas";

export type ParaOrdenar = { fechaRetiro: FechaISO | null; alta: string };

export function ordenarPorRetiro<T extends ParaOrdenar>(filas: T[], hoy: FechaISO): T[] {
  const grupo = (f: T) => (f.fechaRetiro === null ? 2 : f.fechaRetiro <= hoy ? 0 : 1);
  return [...filas].sort((a, b) => {
    const g = grupo(a) - grupo(b);
    if (g !== 0) return g;
    if (a.fechaRetiro && b.fechaRetiro && a.fechaRetiro !== b.fechaRetiro) return a.fechaRetiro < b.fechaRetiro ? -1 : 1;
    return a.alta < b.alta ? 1 : a.alta > b.alta ? -1 : 0;
  });
}
