// Configuración (10.9): solo el Director cambia parámetros, usuarios, plantillas, esquemas y
// días inhábiles; nadie borra; un usuario inactivo pierde el acceso al instante.
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL = process.env.DATABASE_URL_TEST ?? "postgresql://rpd:rpd@localhost:5432/rpd_test";
const db = new pg.Client({ connectionString: URL });
const D = randomUUID(), A = randomUUID();

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
  for (const [uid, rol] of [[D, "director"], [A, "asesor"]]) {
    const email = `${rol}-${uid.slice(0, 6)}@config.mx`;
    await db.query("INSERT INTO auth.users (id, email) VALUES ($1, $2)", [uid, email]);
    await db.query("INSERT INTO usuarios (id, nombre, email, rol, updated_at) VALUES ($1, $2, $3, $4, now())", [uid, `U ${rol}`, email, rol]);
  }
});
afterAll(() => db.end());

describe("configuración solo para el Director", () => {
  it("parámetros: el asesor no programa ni cierra vigencias; el Director sí; nadie borra", async () => {
    await expect(como(A, "INSERT INTO parametros (clave, valor, tipo, vigente_desde) VALUES ('UMA_MENSUAL', '1', 'decimal', '2030-01-01')")).rejects.toThrow();
    expect(await como(A, "UPDATE parametros SET vigente_hasta = '2029-12-31' WHERE clave = 'UMA_MENSUAL' RETURNING id")).toHaveLength(0);
    await como(D, "INSERT INTO parametros (clave, valor, tipo, vigente_desde) VALUES ('UMA_MENSUAL', '9999', 'decimal', '2030-01-01')");
    await expect(como(D, "DELETE FROM parametros WHERE clave = 'UMA_MENSUAL'")).rejects.toThrow(/permission denied/);
  });
  it("usuarios: el asesor no se cambia el rol ni da de alta; el Director sí", async () => {
    expect(await como(A, "UPDATE usuarios SET rol = 'director' WHERE id = $1 RETURNING id", [A])).toHaveLength(0);
    await expect(como(A, "INSERT INTO usuarios (id, nombre, email, rol) VALUES (gen_random_uuid(), 'X', 'x@x.mx', 'asesor')")).rejects.toThrow();
    expect(await como(D, "UPDATE usuarios SET telefono = '7770000000' WHERE id = $1 RETURNING id", [A])).toHaveLength(1);
  });
  it("un usuario inactivo pierde el acceso a los datos al instante", async () => {
    expect((await como(A, "SELECT app.rol() AS r"))[0]).toEqual({ r: "asesor" });
    await como(D, "UPDATE usuarios SET activo = false WHERE id = $1", [A]);
    expect((await como(A, "SELECT app.rol() AS r"))[0]).toEqual({ r: null });
    expect(await como(A, "SELECT id FROM parametros LIMIT 1")).toHaveLength(0);
    await como(D, "UPDATE usuarios SET activo = true WHERE id = $1", [A]);
  });
  it("días inhábiles: se desactivan (no se borran); plantillas y esquemas solo el Director", async () => {
    await como(D, "INSERT INTO dias_inhabiles (fecha, descripcion) VALUES ('2030-12-24', 'Prueba')");
    await como(D, "UPDATE dias_inhabiles SET activo = false WHERE fecha = '2030-12-24'");
    expect((await db.query("SELECT activo FROM dias_inhabiles WHERE fecha = '2030-12-24'")).rows[0]).toEqual({ activo: false });
    await expect(como(D, "DELETE FROM dias_inhabiles WHERE fecha = '2030-12-24'")).rejects.toThrow(/permission denied/);
    await expect(como(A, "INSERT INTO plantillas_contrato (clase, tipo_servicio, version, cuerpo, vigente_desde) VALUES ('contrato', 'X', 9, 'x', '2030-01-01')")).rejects.toThrow();
    expect(await como(A, "UPDATE plantillas_mensaje SET cuerpo = 'x' RETURNING clave")).toHaveLength(0);
    expect(await como(A, "UPDATE esquemas_comision SET vigente_hasta = '2030-01-01' RETURNING id")).toHaveLength(0);
  });
  it("la bitácora solo la lee el Director", async () => {
    expect(await como(A, "SELECT id FROM auditoria.auditoria LIMIT 1")).toHaveLength(0);
    expect((await como(D, "SELECT count(*)::int AS n FROM auditoria.auditoria WHERE tabla = 'parametros'"))[0].n).toBeGreaterThan(0);
  });
});
