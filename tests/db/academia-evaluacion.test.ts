// Academia fase C: solo el Director evalúa (y no a sí mismo); la persona ve sus evaluaciones; incidencias de línea
// roja suspenden todo y bloquean permisos incluso con excepción; el Director reactiva; nadie borra.
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL = process.env.DATABASE_URL_TEST ?? "postgresql://rpd:rpd@localhost:5432/rpd_test";
const db = new pg.Client({ connectionString: URL });
const D = randomUUID(), A = randomUUID(), S1 = randomUUID(), S2 = randomUUID(), SOCIO1 = randomUUID(), SOCIO2 = randomUUID(), P = randomUUID(), C = randomUUID();

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
const permiso = async (uid: string, p: string) => (await como<{ ok: boolean }>(uid, "SELECT app.tiene_permiso($1) AS ok", [p]))[0].ok;

beforeAll(async () => {
  await db.connect();
  await db.query("INSERT INTO socios (id, nombre, updated_at) VALUES ($1, 'Asesor Uno', now()), ($2, 'Asesor Dos', now())", [SOCIO1, SOCIO2]);
  for (const [uid, rol, socio] of [[D, "director", null], [A, "asesor", null], [S1, "socio", SOCIO1], [S2, "socio", SOCIO2]] as const) {
    const email = `${rol}-${uid.slice(0, 6)}@evaluacion.mx`;
    await db.query("INSERT INTO auth.users (id, email) VALUES ($1, $2)", [uid, email]);
    await db.query("INSERT INTO usuarios (id, nombre, email, rol, socio_id, updated_at) VALUES ($1, $2, $3, $4, $5, now())", [uid, `U ${rol}`, email, rol, socio]);
  }
  await db.query("INSERT INTO personas (id, nombre, telefono, origen, owner_id, updated_at) VALUES ($1, 'Cliente Eval', '7770006666', 'web', $2, now())", [P, D]);
  await db.query("INSERT INTO casos (id, persona_id, tipo_servicio, owner_id, socio_id, asignado_a, updated_at) VALUES ($1, $2, 'RETIRO_DESEMPLEO', $3, $4, $5, now())", [C, P, D, SOCIO1, A]);
});
afterAll(async () => { await db.query("UPDATE parametros SET valor = 'apagado' WHERE clave = 'ACADEMIA_BLOQUEOS'"); await db.end(); });

describe("evaluación humana", () => {
  it("solo el Director registra juegos de roles, acompañamientos, diagnósticos y entrevistas; la persona ve los suyos", async () => {
    const rp = "INSERT INTO cap_evaluaciones_roleplay (usuario_id, roleplay, cumple, total, eliminatorio_fallado, aprobado) VALUES ($1, 'RP-01', '{}', 90, false, true)";
    await expect(como(S1, rp, [S1])).rejects.toThrow();
    await expect(como(A, rp, [S1])).rejects.toThrow();
    await como(D, rp, [S1]);
    await como(D, "INSERT INTO cap_shadowing (usuario_id, ruta, caso_id, modo, cumple) VALUES ($1, 'R1', $2, 'observado', true)", [S1, C]);
    await expect(como(D, "INSERT INTO cap_shadowing (usuario_id, ruta, caso_id, modo, cumple) VALUES ($1, 'R2', $2, 'observado', true)", [S1, C])).rejects.toThrow();
    await como(D, "INSERT INTO cap_diagnosticos_validados (usuario_id, caso_id, correccion_grave) VALUES ($1, $2, false)", [S1, C]);
    await como(D, "INSERT INTO cap_entrevistas (usuario_id, aprobada) VALUES ($1, true)", [S1]);
    expect(await como(S1, "SELECT id FROM cap_evaluaciones_roleplay WHERE usuario_id = $1", [S1])).toHaveLength(1);
    expect(await como(S2, "SELECT id FROM cap_shadowing WHERE usuario_id = $1", [S1])).toHaveLength(0);
    await expect(como(D, "DELETE FROM cap_evaluaciones_roleplay WHERE usuario_id = $1", [S1])).rejects.toThrow(/permission denied/);
  });
  it("el Director no se evalúa a sí mismo", async () => {
    await expect(como(D, "INSERT INTO cap_entrevistas (usuario_id, aprobada) VALUES ($1, true)", [D])).rejects.toThrow();
  });
  it("la persona pide su juego de roles (una solicitud pendiente a la vez); el Director la atiende", async () => {
    await como(S1, "INSERT INTO cap_solicitudes (usuario_id, tipo, referencia) VALUES ($1, 'roleplay', 'RP-02')", [S1]);
    await expect(como(S1, "INSERT INTO cap_solicitudes (usuario_id, tipo, referencia) VALUES ($1, 'roleplay', 'RP-02')", [S1])).rejects.toThrow();
    await expect(como(S1, "INSERT INTO cap_solicitudes (usuario_id, tipo, referencia) VALUES ($1, 'roleplay', 'RP-01')", [S2])).rejects.toThrow();
    await expect(como(S1, "UPDATE cap_solicitudes SET estado = 'atendida' WHERE usuario_id = $1", [S1])).rejects.toThrow();
    expect(await como(D, "UPDATE cap_solicitudes SET estado = 'atendida' WHERE usuario_id = $1 RETURNING id", [S1])).toHaveLength(1);
  });
});

describe("incidencias (9.5)", () => {
  it("las registran el Director o el analista; el asesor no; la persona ve las suyas", async () => {
    await expect(como(S2, "INSERT INTO cap_incidencias (usuario_id, tipo, severidad, descripcion) VALUES ($1, 'otro', 'leve', 'Intento de autoregistro')", [S1])).rejects.toThrow();
    await como(A, "INSERT INTO cap_incidencias (usuario_id, caso_id, tipo, severidad, descripcion) VALUES ($1, $2, 'documento_rechazado', 'leve', 'Pidió un comprobante vencido')", [S2, C]);
    expect(await como(S2, "SELECT id FROM cap_incidencias WHERE usuario_id = $1", [S2])).toHaveLength(1);
    expect(await como(S1, "SELECT id FROM cap_incidencias WHERE usuario_id = $1", [S2])).toHaveLength(0);
    await expect(como(D, "DELETE FROM cap_incidencias WHERE usuario_id = $1", [S2])).rejects.toThrow(/permission denied/);
  });
  it("una de línea roja suspende todas sus certificaciones al momento, avisa al Director y bloquea permisos aun con excepción", async () => {
    await db.query("UPDATE parametros SET valor = 'encendido' WHERE clave = 'ACADEMIA_BLOQUEOS'");
    await db.query("INSERT INTO cap_certificaciones (usuario_id, ruta) VALUES ($1, 'N0'), ($1, 'R1')", [S1]);
    await como(D, "INSERT INTO cap_excepciones (usuario_id, ruta, hasta, motivo) VALUES ($1, 'R2', current_date + 5, 'Caso acompañado')", [S1]);
    expect(await permiso(S1, "precalificacion.retiro")).toBe(true);
    await como(D, "INSERT INTO cap_incidencias (usuario_id, caso_id, tipo, severidad, descripcion) VALUES ($1, $2, 'promesa_monto', 'linea_roja', 'Le garantizó un monto al cliente')", [S1, C]);
    const estados = await db.query("SELECT ruta, estado FROM cap_certificaciones WHERE usuario_id = $1 ORDER BY ruta", [S1]);
    expect(estados.rows).toEqual([{ ruta: "N0", estado: "suspendida" }, { ruta: "R1", estado: "suspendida" }]);
    expect(await permiso(S1, "precalificacion.retiro")).toBe(false);
    expect(await permiso(S1, "prospecto.crear")).toBe(false);
    const alerta = await db.query("SELECT count(*)::int AS n FROM alertas WHERE regla = 'CAP_INCIDENCIA_LINEA_ROJA' AND asignado_a = $1", [D]);
    expect(alerta.rows[0].n).toBeGreaterThan(0);
  });
  it("solo el Director reactiva tras la revisión", async () => {
    expect(await como(S1, "UPDATE cap_certificaciones SET estado = 'vigente' WHERE usuario_id = $1 RETURNING id", [S1])).toHaveLength(0);
    await expect(como(A, "UPDATE cap_certificaciones SET estado = 'vigente' WHERE usuario_id = $1", [S1])).resolves.toHaveLength(0);
    expect(await como(D, "UPDATE cap_certificaciones SET estado = 'vigente', motivo = 'Reactivada tras revisión' WHERE usuario_id = $1 RETURNING id", [S1])).toHaveLength(2);
    expect(await permiso(S1, "precalificacion.retiro")).toBe(true);
    await expect(como(D, "UPDATE cap_certificaciones SET estado = 'por_vencer' WHERE usuario_id = $1", [S1])).rejects.toThrow();
  });
});

describe("metas (sección 10)", () => {
  it("todos las ven; solo el Director las cambia", async () => {
    expect((await como(S1, "SELECT count(*)::int AS n FROM cap_metas"))[0]).toMatchObject({ n: 9 });
    await expect(como(S1, "INSERT INTO cap_metas (metrica, valor, vigente_desde) VALUES ('contacto_24h', 0.5, current_date)")).rejects.toThrow();
    await como(D, "INSERT INTO cap_metas (metrica, valor, vigente_desde) VALUES ('contacto_24h', 0.85, current_date)");
    expect(await como(S1, "UPDATE cap_metas SET valor = 0.1 WHERE metrica = 'contacto_24h' RETURNING id")).toHaveLength(0);
    expect(await como(D, "UPDATE cap_metas SET valor = 0.8 WHERE metrica = 'contacto_24h' AND vigente_desde = current_date RETURNING id")).toHaveLength(1);
  });
});
