// Lee una constancia de semanas guardada en el expediente (servidor): bytes del almacén → renglones → datos.
import "server-only";
import { leerArchivo } from "@/lib/documentos/almacen";
import { esConstanciaSemanas, leerConstancia, type LecturaConstancia } from "@/lib/reglas/constancia";
import { renglonesDePdf } from "./extraer";

export async function leerConstanciaGuardada(ruta: string): Promise<{ lectura?: LecturaConstancia; error?: string }> {
  let renglones: string[];
  try {
    renglones = await renglonesDePdf(await leerArchivo(ruta));
  } catch (e) {
    console.error("[constancia]", e);
    return { error: "No se pudo abrir el PDF. Si es una foto o un escaneo, captura los datos a mano en IMSS y Afore." };
  }
  if (!esConstanciaSemanas(renglones)) {
    return { error: "Este archivo no parece la constancia de semanas del IMSS (o es una foto/escaneo sin texto). Captura los datos a mano." };
  }
  return { lectura: leerConstancia(renglones) };
}
