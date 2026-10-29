"use server";

// Mover un caso desde el tablero: misma acción y mismas reglas que el «Siguiente paso» del expediente.
import { cambiarEtapa, type Resultado } from "./[id]/acciones";

export async function moverCaso(casoId: string, destino: string, motivo: string | null): Promise<Resultado> {
  const form = new FormData();
  form.set("destino", destino);
  if (motivo) form.set("motivo", motivo);
  return cambiarEtapa(casoId, {}, form);
}
