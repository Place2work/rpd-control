// Fase 4: Modalidad 40. Los pagos los ve y registra quien opera el caso (no el vendedor);
// el plan no puede terminar antes de empezar; nadie borra.
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL = process.env.DATABASE_URL_TEST ?? "postgresql://rpd:rpd@localhost:5432/rpd_test";
const db = new pg.Client({ connectionString: URL });
const id = () => randomUUID();
const U = { asesor: id(), vendedor: id() };
const P = id(), C = id(), PAGO = id();

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
    const email = `${rol}-${uid.slice(0, 6)}@pension.mx`;
    await db.query("INSERT INTO auth.users (id, email) VALUES ($1, $2)", [uid, email]);
    await db.query("INSERT INTO usuarios (id, nombre, email, rol, updated_at) VALUES ($1, $2, $3, $4, now())", [uid, `U ${rol}`, email, rol]);
  }
  await db.query("INSERT INTO personas (id, nombre, telefono, origen, owner_id, updated_at) VALUES ($1, 'Rosa', '7770003333', 'vendedor', $2, now())", [P, U.vendedor]);
  await db.query("INSERT INTO casos (id, persona_id, tipo_servicio, owner_id, vendedor_id, asignado_a, updated_at) VALUES ($1, $2, 'MODALIDAD_40', $3, $3, $4, now())", [C, P, U.vendedor, U.asesor]);
  await db.query("INSERT INTO pagos_m40 (id, caso_id, mes, monto, fecha_limite, updated_at) VALUES ($1, $2, '2026-11-01', 4250.50, '2026-11-17', now())", [PAGO, C]);
});
afterAll(() => db.end());

describe("Modalidad 40", () => {
  it("el asesor ve y registra el pago; el vendedor no lo ve", async () => {
    expect(await como(U.vendedor, "SELECT id FROM pagos_m40 WHERE caso_id = $1", [C])).toHaveLength(0);
    expect(await como(U.asesor, "UPDATE pagos_m40 SET fecha_pago = '2026-11-10' WHERE id = $1 RETURNING id", [PAGO])).toHaveLength(1);
    await expect(como(U.asesor, "DELETE FROM pagos_m40 WHERE id = $1", [PAGO])).rejects.toThrow(/permission denied/);
  });
  it("el plan no puede terminar antes de empezar", async () => {
    await expect(db.query("UPDATE casos SET m40_desde = '2027-01-01', m40_hasta = '2026-12-01' WHERE id = $1", [C])).rejects.toThrow(/casos_m40_periodo/);
  });
  it("los plazos de 7.6 están como parámetros", async () => {
    const r = await db.query("SELECT clave, valor FROM parametros WHERE clave IN ('M40_MESES_BAJA', 'M40_DIA_LIMITE', 'CONSERVACION_FRACCION') ORDER BY clave");
    expect(r.rows).toEqual([{ clave: "CONSERVACION_FRACCION", valor: "0.25" }, { clave: "M40_DIA_LIMITE", valor: "17" }, { clave: "M40_MESES_BAJA", valor: "2" }]);
  });
});
