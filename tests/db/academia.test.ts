// Academia (13-nov): cada quien ve y escribe solo su avance; el Director ve el de todos; intentos y
// certificaciones solo los escribe el motor (nadie se autoaprueba); nadie borra.
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL = process.env.DATABASE_URL_TEST ?? "postgresql://rpd:rpd@localhost:5432/rpd_test";
const db = new pg.Client({ connectionString: URL });
const D = randomUUID(), S1 = randomUUID(), S2 = randomUUID();

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
  for (const [uid, rol] of [[D, "director"], [S1, "socio"], [S2, "socio"]] as const) {
    const email = `${rol}-${uid.slice(0, 6)}@academia.mx`;
    await db.query("INSERT INTO auth.users (id, email) VALUES ($1, $2)", [uid, email]);
    await db.query("INSERT INTO usuarios (id, nombre, email, rol, updated_at) VALUES ($1, $2, $3, $4, now())", [uid, `U ${rol}`, email, rol]);
  }
});
afterAll(() => db.end());

describe("academia: avance propio", () => {
  it("cada quien marca sus lecturas y firma sus acuses; no los de otro", async () => {
    await como(S1, "INSERT INTO cap_progreso (usuario_id, modulo, version, completado_at) VALUES ($1, 'N0-01', 1, now())", [S1]);
    await como(S1, "INSERT INTO cap_acuses (usuario_id, documento, version) VALUES ($1, 'codigo_conducta', '2026-11')", [S1]);
    await expect(como(S1, "INSERT INTO cap_progreso (usuario_id, modulo, version) VALUES ($1, 'N0-01', 1)", [S2])).rejects.toThrow();
    await expect(como(S1, "INSERT INTO cap_acuses (usuario_id, documento, version) VALUES ($1, 'codigo_conducta', '2026-11')", [S2])).rejects.toThrow();
    expect(await como(S2, "SELECT id FROM cap_progreso WHERE usuario_id = $1", [S1])).toHaveLength(0);
    expect(await como(D, "SELECT id FROM cap_progreso WHERE usuario_id = $1", [S1])).toHaveLength(1);
  });
  it("nadie escribe intentos ni certificaciones (los escribe el motor); nadie borra", async () => {
    await expect(como(S1, "INSERT INTO cap_intentos (usuario_id, tipo, objetivo, preguntas, aprobado) VALUES ($1, 'examen_ruta', 'N0', '[]', true)", [S1])).rejects.toThrow(/permission denied/);
    await expect(como(S1, "INSERT INTO cap_certificaciones (usuario_id, ruta) VALUES ($1, 'N0')", [S1])).rejects.toThrow(/permission denied/);
    await expect(como(D, "INSERT INTO cap_certificaciones (usuario_id, ruta) VALUES ($1, 'R1')", [S1])).rejects.toThrow(/permission denied/);
    await db.query("INSERT INTO cap_intentos (usuario_id, tipo, objetivo, preguntas, fin, aprobado) VALUES ($1, 'examen_ruta', 'N0', '[]', now(), false)", [S1]);
    await expect(como(S1, "UPDATE cap_intentos SET aprobado = true WHERE usuario_id = $1", [S1])).rejects.toThrow(/permission denied/);
    await expect(como(S1, "DELETE FROM cap_progreso WHERE usuario_id = $1", [S1])).rejects.toThrow(/permission denied/);
    await expect(como(D, "DELETE FROM cap_acuses WHERE usuario_id = $1", [S1])).rejects.toThrow(/permission denied/);
  });
  it("cada quien ve sus intentos y certificaciones; el Director, los de todos; una sola certificación viva por ruta", async () => {
    await db.query("INSERT INTO cap_certificaciones (usuario_id, ruta) VALUES ($1, 'N0')", [S1]);
    await expect(db.query("INSERT INTO cap_certificaciones (usuario_id, ruta) VALUES ($1, 'N0')", [S1])).rejects.toThrow();
    expect(await como(S1, "SELECT ruta FROM cap_certificaciones WHERE usuario_id = $1", [S1])).toEqual([{ ruta: "N0" }]);
    expect(await como(S2, "SELECT id FROM cap_certificaciones WHERE usuario_id = $1", [S1])).toHaveLength(0);
    expect(await como(S2, "SELECT id FROM cap_intentos WHERE usuario_id = $1", [S1])).toHaveLength(0);
    expect(await como(D, "SELECT id FROM cap_intentos WHERE usuario_id = $1", [S1])).toHaveLength(1);
  });
});
