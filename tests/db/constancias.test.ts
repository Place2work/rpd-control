// Trámite asistido de la constancia (12-nov): solicitudes con RLS por caso; correos del buzón solo los escribe el
// sistema y solo los ven/asignan el Director y el analista; ligas solo de imss.gob.mx; nadie borra.
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
    const email = `${rol}-${uid.slice(0, 6)}@const.mx`;
    await db.query("INSERT INTO auth.users (id, email) VALUES ($1, $2)", [uid, email]);
    await db.query("INSERT INTO usuarios (id, nombre, email, rol, socio_id, updated_at) VALUES ($1, $2, $3, $4, $5, now())", [uid, `U ${rol}`, email, rol, socio]);
  }
  await db.query("INSERT INTO personas (id, nombre, telefono, origen, owner_id, updated_at) VALUES ($1, 'Cliente Const', '7770008888', 'web', $2, now())", [P, D]);
  await db.query("INSERT INTO casos (id, persona_id, tipo_servicio, owner_id, socio_id, asignado_a, updated_at) VALUES ($1, $2, 'RETIRO_DESEMPLEO', $3, $4, $5, now())", [C, P, D, SOCIO1, A]);
});
afterAll(() => db.end());

describe("solicitudes de constancia", () => {
  it("las crea quien opera el caso, solo como «pendiente»; otro asesor no las ve; nadie borra", async () => {
    await como(S1, "INSERT INTO solicitudes_constancia (caso_id, persona_id) VALUES ($1, $2)", [C, P]);
    await expect(como(S1, "INSERT INTO solicitudes_constancia (caso_id, persona_id, estado) VALUES ($1, $2, 'recibida')", [C, P])).rejects.toThrow();
    await expect(como(S2, "INSERT INTO solicitudes_constancia (caso_id, persona_id) VALUES ($1, $2)", [C, P])).rejects.toThrow();
    expect(await como(S2, "SELECT id FROM solicitudes_constancia WHERE caso_id = $1", [C])).toHaveLength(0);
    expect(await como(A, "SELECT id FROM solicitudes_constancia WHERE caso_id = $1", [C])).toHaveLength(1);
    await expect(como(D, "DELETE FROM solicitudes_constancia WHERE caso_id = $1", [C])).rejects.toThrow(/permission denied/);
  });
  it("la liga de confirmación solo puede ser de imss.gob.mx", async () => {
    await expect(como(A, "UPDATE solicitudes_constancia SET estado = 'confirmar', liga_confirmacion = 'https://phishing.com/imss.gob.mx' WHERE caso_id = $1", [C])).rejects.toThrow();
    expect(await como(A, "UPDATE solicitudes_constancia SET estado = 'confirmar', liga_confirmacion = 'https://serviciosdigitales.imss.gob.mx/x?t=1' WHERE caso_id = $1 RETURNING id", [C])).toHaveLength(1);
  });
});

describe("correos del buzón de constancias", () => {
  it("solo los escribe el sistema; los ven el Director y el analista, no el asesor de pensiones", async () => {
    await expect(como(D, "INSERT INTO correos_entrantes (resend_id, remitente, tipo, estado) VALUES ('x1', 'a@imss.gob.mx', 'otro', 'sin_caso')")).rejects.toThrow(/permission denied/);
    await db.query("INSERT INTO correos_entrantes (resend_id, remitente, tipo, estado) VALUES ('t-1', 'noresponder@imss.gob.mx', 'confirmacion', 'sin_caso')");
    expect(await como(A, "SELECT id FROM correos_entrantes WHERE resend_id = 't-1'")).toHaveLength(1);
    expect(await como(S1, "SELECT id FROM correos_entrantes WHERE resend_id = 't-1'")).toHaveLength(0);
  });
  it("el analista lo asigna a un caso que opera; no puede cambiar remitente ni borrar", async () => {
    expect(await como(A, "UPDATE correos_entrantes SET estado = 'ligado', caso_id = $1 WHERE resend_id = 't-1' RETURNING id", [C])).toHaveLength(1);
    await expect(como(A, "UPDATE correos_entrantes SET remitente = 'otro@x.mx' WHERE resend_id = 't-1'")).rejects.toThrow(/permission denied/);
    await expect(como(D, "DELETE FROM correos_entrantes WHERE resend_id = 't-1'")).rejects.toThrow(/permission denied/);
    expect(await como(S1, "UPDATE correos_entrantes SET estado = 'descartado' WHERE resend_id = 't-1' RETURNING id")).toHaveLength(0);
  });
});
