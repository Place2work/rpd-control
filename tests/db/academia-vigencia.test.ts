// Academia fase D: cambios de parámetros quedan registrados por disparador; preguntas en revisión y cambios solo los
// ve el Director; microlecciones publicadas las ven todos pero nunca sus respuestas; nadie escribe sus propias
// aprobaciones ni repasos; la línea roja deja dicho el origen de la suspensión; nadie borra.
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL = process.env.DATABASE_URL_TEST ?? "postgresql://rpd:rpd@localhost:5432/rpd_test";
const db = new pg.Client({ connectionString: URL });
const D = randomUUID(), S1 = randomUUID(), S2 = randomUUID(), SOCIO1 = randomUUID(), SOCIO2 = randomUUID();
const CLAVE = `PRUEBA_VIGENCIA_${randomUUID().slice(0, 8).toUpperCase()}`;

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

let cambio = "", borrador = "", publicada = "";
beforeAll(async () => {
  await db.connect();
  await db.query("INSERT INTO socios (id, nombre, updated_at) VALUES ($1, 'Asesor V1', now()), ($2, 'Asesor V2', now())", [SOCIO1, SOCIO2]);
  for (const [uid, rol, socio] of [[D, "director", null], [S1, "socio", SOCIO1], [S2, "socio", SOCIO2]] as const) {
    const email = `${rol}-${uid.slice(0, 6)}@vigencia.mx`;
    await db.query("INSERT INTO auth.users (id, email) VALUES ($1, $2)", [uid, email]);
    await db.query("INSERT INTO usuarios (id, nombre, email, rol, socio_id, updated_at) VALUES ($1, $2, $3, $4, $5, now())", [uid, `V ${rol}`, email, rol, socio]);
  }
});
afterAll(async () => { await db.end(); });

describe("cambios de parámetros (9.6)", () => {
  it("una vigencia nueva con otro valor se registra; el mismo valor o un parámetro nuevo, no", async () => {
    await db.query("INSERT INTO parametros (clave, valor, tipo, descripcion, vigente_desde) VALUES ($1, '100', 'entero', 'prueba', DATE '2026-01-01')", [CLAVE]);
    await db.query("INSERT INTO parametros (clave, valor, tipo, descripcion, vigente_desde) VALUES ($1, '100', 'entero', 'prueba', DATE '2027-01-01')", [CLAVE]);
    expect((await db.query("SELECT count(*)::int AS n FROM cap_cambios_parametro WHERE parametro_clave = $1", [CLAVE])).rows[0].n).toBe(0);
    await db.query("INSERT INTO parametros (clave, valor, tipo, descripcion, vigente_desde) VALUES ($1, '120', 'entero', 'prueba', DATE '2027-02-01')", [CLAVE]);
    const r = await db.query("SELECT id, anterior, valor FROM cap_cambios_parametro WHERE parametro_clave = $1", [CLAVE]);
    expect(r.rows).toMatchObject([{ anterior: "100", valor: "120" }]);
    cambio = r.rows[0].id;
  });
  it("corregir el valor de una vigencia futura también se registra", async () => {
    await db.query("UPDATE parametros SET valor = '125' WHERE clave = $1 AND vigente_desde = DATE '2027-02-01'", [CLAVE]);
    expect((await db.query("SELECT count(*)::int AS n FROM cap_cambios_parametro WHERE parametro_clave = $1", [CLAVE])).rows[0].n).toBe(2);
  });
  it("solo el Director ve los cambios y las preguntas en revisión, y solo él las confirma", async () => {
    await db.query("INSERT INTO cap_preguntas_revision (pregunta, version, cambio_id) VALUES ('R1-Q04', 1, $1)", [cambio]);
    expect(await como(S1, "SELECT id FROM cap_cambios_parametro WHERE id = $1", [cambio])).toHaveLength(0);
    expect(await como(S1, "SELECT id FROM cap_preguntas_revision WHERE cambio_id = $1", [cambio])).toHaveLength(0);
    expect(await como(S1, "UPDATE cap_preguntas_revision SET estado = 'vigente', revisada_por = $2 WHERE cambio_id = $1 RETURNING id", [cambio, S1])).toHaveLength(0);
    await expect(como(D, "UPDATE cap_preguntas_revision SET estado = 'vigente', revisada_por = $2 WHERE cambio_id = $1", [cambio, S1])).rejects.toThrow();
    expect(await como(D, "UPDATE cap_preguntas_revision SET estado = 'vigente', revisada_por = $2, revisada_at = now() WHERE cambio_id = $1 RETURNING id", [cambio, D])).toHaveLength(1);
    await expect(como(D, "DELETE FROM cap_preguntas_revision WHERE cambio_id = $1", [cambio])).rejects.toThrow(/permission denied/);
  });
});

describe("microlecciones (9.5)", () => {
  it("el borrador solo lo ve el Director; la publicada la ven todos, pero nadie lee sus respuestas", async () => {
    const preguntas = JSON.stringify([{ clave: "X-Q1", tipo: "opcion_multiple", enunciado: "¿?", opciones: ["a", "b"], correcta: 1, tolerancia: null, explicacion: null, critica: false }]);
    borrador = (await db.query("INSERT INTO cap_actualizaciones (plantilla, cambio_id, parametro_clave, vigente_desde, titulo, contenido, preguntas) VALUES ('T1', $1, $2, DATE '2027-02-01', 'Borrador', 'Texto', $3) RETURNING id", [cambio, CLAVE, preguntas])).rows[0].id;
    publicada = (await db.query("INSERT INTO cap_actualizaciones (plantilla, cambio_id, parametro_clave, vigente_desde, titulo, contenido, preguntas) VALUES ('T2', $1, $2, DATE '2027-02-01', 'Lista', 'Texto', $3) RETURNING id", [cambio, CLAVE, preguntas])).rows[0].id;
    await expect(como(D, "UPDATE cap_actualizaciones SET estado = 'publicada', publicada_at = now(), publicada_por = $2, fecha_limite = current_date + 30 WHERE id = $1", [publicada, S1])).rejects.toThrow();
    expect(await como(D, "UPDATE cap_actualizaciones SET estado = 'publicada', publicada_at = now(), publicada_por = $2, fecha_limite = current_date + 30 WHERE id = $1 RETURNING id", [publicada, D])).toHaveLength(1);
    expect(await como(S1, "SELECT id FROM cap_actualizaciones WHERE id IN ($1, $2)", [borrador, publicada])).toEqual([{ id: publicada }]);
    await expect(como(S1, "SELECT preguntas FROM cap_actualizaciones WHERE id = $1", [publicada])).rejects.toThrow(/permission denied/);
    await expect(como(D, "SELECT preguntas FROM cap_actualizaciones WHERE id = $1", [publicada])).rejects.toThrow(/permission denied/);
    expect(await como(S1, "UPDATE cap_actualizaciones SET estado = 'publicada', publicada_at = now(), fecha_limite = current_date WHERE id = $1 RETURNING id", [borrador])).toHaveLength(0);
  });
  it("una publicada necesita fecha y límite", async () => {
    await expect(db.query("UPDATE cap_actualizaciones SET estado = 'publicada' WHERE id = $1", [borrador])).rejects.toThrow();
  });
  it("nadie registra su propia aprobación; cada quien ve las suyas", async () => {
    await expect(como(S1, "INSERT INTO cap_actualizaciones_usuario (actualizacion_id, usuario_id) VALUES ($1, $2)", [publicada, S1])).rejects.toThrow(/permission denied/);
    await db.query("INSERT INTO cap_actualizaciones_usuario (actualizacion_id, usuario_id) VALUES ($1, $2)", [publicada, S1]);
    expect(await como(S1, "SELECT id FROM cap_actualizaciones_usuario WHERE actualizacion_id = $1", [publicada])).toHaveLength(1);
    expect(await como(S2, "SELECT id FROM cap_actualizaciones_usuario WHERE actualizacion_id = $1", [publicada])).toHaveLength(0);
  });
});

describe("repasos, recertificación y suspensiones", () => {
  it("los repasos los crea el motor; la persona ve los suyos y no puede escribirlos; uno abierto por módulo", async () => {
    await expect(como(S1, "INSERT INTO cap_repasos (usuario_id, modulo, motivo, fecha_limite) VALUES ($1, 'R1-06', 'x', current_date + 14)", [S1])).rejects.toThrow(/permission denied/);
    await db.query("INSERT INTO cap_repasos (usuario_id, modulo, motivo, fecha_limite) VALUES ($1, 'R1-06', '2 graves', current_date + 14)", [S1]);
    await expect(db.query("INSERT INTO cap_repasos (usuario_id, modulo, motivo, fecha_limite) VALUES ($1, 'R1-06', '2 graves', current_date + 14)", [S1])).rejects.toThrow();
    expect(await como(S1, "SELECT id FROM cap_repasos WHERE usuario_id = $1", [S1])).toHaveLength(1);
    expect(await como(S2, "SELECT id FROM cap_repasos WHERE usuario_id = $1", [S1])).toHaveLength(0);
    expect(await como(S1, "UPDATE cap_repasos SET archivado_at = now() WHERE usuario_id = $1 RETURNING id", [S1])).toHaveLength(0);
  });
  it("la recertificación y el quiz de microlección son intentos válidos", async () => {
    await db.query("INSERT INTO cap_intentos (usuario_id, tipo, objetivo, preguntas) VALUES ($1, 'recertificacion', 'R1', '[]'), ($1, 'actualizacion', $2, '[]')", [S1, publicada]);
    await expect(db.query("INSERT INTO cap_intentos (usuario_id, tipo, objetivo, preguntas) VALUES ($1, 'otro', 'R1', '[]')", [S1])).rejects.toThrow();
  });
  it("la línea roja suspende también lo ya suspendido por microlección y deja dicho el origen", async () => {
    await db.query("INSERT INTO cap_certificaciones (usuario_id, ruta, estado, suspendida_por) VALUES ($1, 'N0', 'vigente', NULL), ($1, 'R1', 'suspendida', 'actualizacion:x')", [S2]);
    await como(D, "INSERT INTO cap_incidencias (usuario_id, tipo, severidad, descripcion) VALUES ($1, 'promesa_monto', 'linea_roja', 'Prometió un monto')", [S2]);
    const r = await db.query("SELECT ruta, estado, suspendida_por FROM cap_certificaciones WHERE usuario_id = $1 ORDER BY ruta", [S2]);
    expect(r.rows).toEqual([{ ruta: "N0", estado: "suspendida", suspendida_por: "linea_roja" }, { ruta: "R1", estado: "suspendida", suspendida_por: "linea_roja" }]);
    expect(await como(D, "UPDATE cap_certificaciones SET estado = 'vigente', suspendida_por = NULL, motivo = 'Revisado' WHERE usuario_id = $1 RETURNING id", [S2])).toHaveLength(2);
  });
});
