import "server-only";
import { descifrar, hashIdentificador } from "@/lib/cripto";
import { tipoIdentificador } from "@/lib/reglas/identificadores";
import { conUsuario, type ClaimsUsuario } from "./prisma";

type Dato = { tabla: "personas" | "partes_caso"; campo: "curp" | "nss" } | { tabla: "datos_afore" | "referidores" | "socios"; campo: "clabe" };

// Ver el dato completo: la base valida el rol y deja un renglón VER_SENSIBLE en la bitácora.
export async function verDatoSensible(claims: ClaimsUsuario, dato: Dato, id: string, ip?: string | null) {
  const filas = await conUsuario(
    claims,
    (tx) => tx.$queryRaw<{ v: Uint8Array | null }[]>`SELECT app.ver_dato_sensible(${dato.tabla}, ${id}::uuid, ${dato.campo}) AS v`,
    ip,
  );
  const v = filas[0]?.v;
  return v ? descifrar(v) : null;
}

// Búsqueda por CURP o NSS con el índice ciego; RLS decide qué personas ve cada rol.
export async function buscarPorIdentificador(claims: ClaimsUsuario, q: string) {
  const tipo = tipoIdentificador(q);
  if (!tipo) return null;
  const hash = hashIdentificador(tipo, q);
  return conUsuario(claims, (tx) =>
    tx.persona.findMany({
      where: tipo === "curp" ? { curp_hash: hash } : { nss_hash: hash },
      select: { id: true, nombre: true, apellido_paterno: true, nss_ultimos4: true, curp_parcial: true },
    }),
  );
}
