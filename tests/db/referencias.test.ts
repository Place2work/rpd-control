// Referencias personales (11-nov): las ve y edita quien ve a la persona; el asesor de pensiones solo las de sus
// clientes; nadie borra (se archivan). Y los dos documentos que ya no se piden quedan inactivos.
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL = process.env.DATABASE_URL_TEST ?? "postgresql://rpd:rpd@localhost:5432/rpd_test";
const db = new pg.Client({ connectionString: URL });
const D = randomUUID(), A = randomUUID(), S1 = randomUUID(), S2 = randomUUID();
const SOCIO1 = randomUUID(), SOCIO2 = randomUUID(), P = randomUUID(), C = randomUUID();

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
  await db.query("INSERT INTO socios (id, nombre, updated_at) VALUES ($1, 'Asesor Uno', now()), ($2, 'Asesor Dos', now())", [SOCIO1, SOCIO2]);
  for (const [uid, rol, socio] of [[D, "director", null], [A, "asesor", null], [S1, "socio", SOCIO1], [S2, "socio", SOCIO2]] as const) {
    const email = `${rol}-${uid.slice(0, 6)}@ref.mx`;
    await db.query("INSERT INTO auth.users (id, email) VALUES ($1, $2)", [uid, email]);
    await db.query("INSERT INTO usuarios (id, nombre, email, rol, socio_id, updated_at) VALUES ($1, $2, $3, $4, $5, now())", [uid, `U ${rol}`, email, rol, socio]);
  }
  await db.query("INSERT INTO personas (id, nombre, telefono, origen, owner_id, updated_at) VALUES ($1, 'Cliente Ref', '7770009999', 'web', $2, now())", [P, D]);
  await db.query("INSERT INTO casos (id, persona_id, tipo_servicio, owner_id, socio_id, updated_at) VALUES ($1, $2, 'RETIRO_DESEMPLEO', $3, $4, now())", [C, P, D, SOCIO1]);
});
afterAll(() => db.end());

describe("referencias personales", () => {
  it("el analista y el asesor de pensiones del caso las capturan; otro asesor no las ve ni las crea", async () => {
    await como(A, "INSERT INTO referencias_personales (persona_id, orden, nombre, telefono, parentesco) VALUES ($1, 1, 'María López', '+525511112222', 'hermano')", [P]);
    await como(S1, "INSERT INTO referencias_personales (persona_id, orden, nombre, telefono, parentesco) VALUES ($1, 2, 'Juan Pérez', '+525533334444', 'amigo')", [P]);
    expect(await como(S1, "SELECT orden FROM referencias_personales WHERE persona_id = $1 ORDER BY orden", [P])).toEqual([{ orden: 1 }, { orden: 2 }]);
    expect(await como(S2, "SELECT id FROM referencias_personales WHERE persona_id = $1", [P])).toHaveLength(0);
    await expect(como(S2, "INSERT INTO referencias_personales (persona_id, orden, nombre) VALUES ($1, 1, 'Intruso X')", [P])).rejects.toThrow();
    expect(await como(S2, "UPDATE referencias_personales SET nombre = 'X' WHERE persona_id = $1 RETURNING id", [P])).toHaveLength(0);
  });
  it("solo dos vivas por cliente; nadie borra: se archivan y queda libre el lugar", async () => {
    await expect(como(D, "INSERT INTO referencias_personales (persona_id, orden, nombre) VALUES ($1, 1, 'Otra Persona')", [P])).rejects.toThrow();
    await expect(como(D, "INSERT INTO referencias_personales (persona_id, orden, nombre) VALUES ($1, 3, 'Tercera Persona')", [P])).rejects.toThrow();
    await expect(como(D, "DELETE FROM referencias_personales WHERE persona_id = $1", [P])).rejects.toThrow(/permission denied/);
    await como(D, "UPDATE referencias_personales SET archivado_at = now() WHERE persona_id = $1 AND orden = 1", [P]);
    await como(D, "INSERT INTO referencias_personales (persona_id, orden, nombre) VALUES ($1, 1, 'Nueva Referencia')", [P]);
    expect((await db.query("SELECT count(*)::int AS n FROM referencias_personales WHERE persona_id = $1", [P])).rows[0]).toEqual({ n: 3 });
  });
});

describe("documentos que ya no se piden", () => {
  it("certificación de baja y comprobante de registro en Afore quedan inactivos", async () => {
    const r = await db.query("SELECT nombre, activo FROM tipos_documento WHERE nombre IN ('Certificación de baja del IMSS', 'Comprobante de registro en Afore') ORDER BY nombre");
    expect(r.rows).toEqual([{ nombre: "Certificación de baja del IMSS", activo: false }, { nombre: "Comprobante de registro en Afore", activo: false }]);
  });
});
