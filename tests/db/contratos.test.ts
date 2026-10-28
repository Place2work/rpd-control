// Fase 4: partes del caso (beneficiaria y finado) con CURP/NSS cifrados. El vendedor no las ve;
// el cifrado no se lee directo; el dato completo solo con ver_dato_sensible() y deja bitácora.
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL = process.env.DATABASE_URL_TEST ?? "postgresql://rpd:rpd@localhost:5432/rpd_test";
const db = new pg.Client({ connectionString: URL });
const id = () => randomUUID();
const U = { asesor: id(), vendedor: id() };
const P = id(), C = id(), FIN = id();

async function como<T = Record<string, unknown>>(uid: string, sql: string, params: unknown[] = []) {
  await db.query("BEGIN");
  try {
    await db.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, aal: "aal2", role: "authenticated" })]);
    await db.query("SET LOCAL ROLE authenticated");
    const r = await db.query(sql, params);
    await db.query("COMMIT");
    return r.rows as T[];
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  }
}

beforeAll(async () => {
  await db.connect();
  for (const [uid, rol] of [[U.asesor, "asesor"], [U.vendedor, "vendedor"]]) {
    const email = `${rol}-${uid.slice(0, 6)}@contratos.mx`;
    await db.query("INSERT INTO auth.users (id, email) VALUES ($1, $2)", [uid, email]);
    await db.query("INSERT INTO usuarios (id, nombre, email, rol, updated_at) VALUES ($1, $2, $3, $4, now())", [uid, `U ${rol}`, email, rol]);
  }
  await db.query("INSERT INTO personas (id, nombre, telefono, origen, owner_id, domicilio, updated_at) VALUES ($1, 'Ana', '7770002222', 'vendedor', $2, 'Calle 1', now())", [P, U.vendedor]);
  await db.query("INSERT INTO casos (id, persona_id, tipo_servicio, owner_id, vendedor_id, asignado_a, updated_at) VALUES ($1, $2, 'FALLECIMIENTO', $3, $3, $4, now())", [C, P, U.vendedor, U.asesor]);
  await db.query("INSERT INTO partes_caso (id, caso_id, rol, nombre, curp_cifrada, curp_parcial) VALUES ($1, $2, 'finado', 'Juan', '\\x01aa', 'GOPJ••••••••••••01')", [FIN, C]);
});
afterAll(() => db.end());

describe("partes del caso", () => {
  it("el asesor ve la parte pero no el cifrado; el vendedor no la ve", async () => {
    expect(await como(U.asesor, "SELECT nombre, curp_parcial FROM partes_caso WHERE id = $1", [FIN])).toEqual([{ nombre: "Juan", curp_parcial: "GOPJ••••••••••••01" }]);
    await expect(como(U.asesor, "SELECT curp_cifrada FROM partes_caso WHERE id = $1", [FIN])).rejects.toThrow(/permission denied/);
    expect(await como(U.vendedor, "SELECT id FROM partes_caso WHERE id = $1", [FIN])).toHaveLength(0);
  });
  it("el vendedor no puede agregar partes; nadie borra", async () => {
    await expect(como(U.vendedor, "INSERT INTO partes_caso (caso_id, rol, nombre) VALUES ($1, 'beneficiaria', 'X')", [C])).rejects.toThrow();
    await expect(como(U.asesor, "DELETE FROM partes_caso WHERE id = $1", [FIN])).rejects.toThrow(/permission denied/);
  });
  it("una sola beneficiaria viva por caso", async () => {
    await como(U.asesor, "INSERT INTO partes_caso (caso_id, rol, nombre) VALUES ($1, 'beneficiaria', 'María')", [C]);
    await expect(como(U.asesor, "INSERT INTO partes_caso (caso_id, rol, nombre) VALUES ($1, 'beneficiaria', 'Otra')", [C])).rejects.toThrow(/partes_caso_rol_vivo/);
  });
  it("ver la CURP completa deja bitácora; el vendedor no puede", async () => {
    const [r] = await como<{ v: Buffer }>(U.asesor, "SELECT app.ver_dato_sensible('partes_caso', $1, 'curp') AS v", [FIN]);
    expect(r.v).toBeTruthy();
    const n = await db.query("SELECT count(*)::int AS n FROM auditoria.auditoria WHERE tabla = 'partes_caso' AND registro_id = $1 AND accion = 'VER_SENSIBLE'", [FIN]);
    expect(n.rows[0].n).toBe(1);
    await expect(como(U.vendedor, "SELECT app.ver_dato_sensible('partes_caso', $1, 'curp')", [FIN])).rejects.toThrow(/no puede ver/);
  });
  it("el domicilio del cliente se lee con los permisos por columna de personas", async () => {
    expect(await como(U.asesor, "SELECT domicilio FROM personas WHERE id = $1", [P])).toEqual([{ domicilio: "Calle 1" }]);
  });
});
