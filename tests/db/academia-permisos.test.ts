// Academia fase B: permisos por certificación con interruptor (apagado por defecto), excepciones temporales del
// Director, candado restrictivo en calculos y simulador escrito solo por el motor.
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL = process.env.DATABASE_URL_TEST ?? "postgresql://rpd:rpd@localhost:5432/rpd_test";
const db = new pg.Client({ connectionString: URL });
const D = randomUUID(), A = randomUUID(), S1 = randomUUID(), S2 = randomUUID(), SOCIO1 = randomUUID(), SOCIO2 = randomUUID();
const P = randomUUID(), C = randomUUID();

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
const interruptor = (valor: "apagado" | "encendido") =>
  db.query("UPDATE parametros SET valor = $1 WHERE clave = 'ACADEMIA_BLOQUEOS'", [valor]);
const calculo = (uid: string, regimen: string) =>
  como(uid, "INSERT INTO calculos (caso_id, version_reglas, fecha_calculo, entradas, uma_diaria, uma_mensual, modalidad_elegible, resultado_automatico, resultado, explicacion) VALUES ($1, 'test', current_date, $2, 117.31, 3566.22, 'A', 'APTO', 'APTO', 'prueba') RETURNING id", [C, JSON.stringify({ regimen })]);

beforeAll(async () => {
  await db.connect();
  await db.query("INSERT INTO socios (id, nombre, updated_at) VALUES ($1, 'Asesor Uno', now()), ($2, 'Asesor Dos', now())", [SOCIO1, SOCIO2]);
  for (const [uid, rol, socio] of [[D, "director", null], [A, "asesor", null], [S1, "socio", SOCIO1], [S2, "socio", SOCIO2]] as const) {
    const email = `${rol}-${uid.slice(0, 6)}@permisos.mx`;
    await db.query("INSERT INTO auth.users (id, email) VALUES ($1, $2)", [uid, email]);
    await db.query("INSERT INTO usuarios (id, nombre, email, rol, socio_id, updated_at) VALUES ($1, $2, $3, $4, $5, now())", [uid, `U ${rol}`, email, rol, socio]);
  }
  await db.query("INSERT INTO personas (id, nombre, telefono, origen, owner_id, updated_at) VALUES ($1, 'Cliente Permisos', '7770007777', 'web', $2, now())", [P, D]);
  await db.query("INSERT INTO casos (id, persona_id, tipo_servicio, owner_id, socio_id, asignado_a, updated_at) VALUES ($1, $2, 'RETIRO_DESEMPLEO', $3, $4, $5, now())", [C, P, D, SOCIO1, A]);
});
afterAll(async () => { await interruptor("apagado"); await db.end(); });

describe("permisos por certificación (3.2)", () => {
  it("con el interruptor apagado (como se entrega) nadie pierde permisos", async () => {
    await interruptor("apagado");
    expect(await permiso(S1, "precalificacion.retiro")).toBe(true);
    expect(await permiso(S1, "precalificacion.retiro.L73")).toBe(true);
    expect((await calculo(S1, "L73")).length).toBe(1);
  });
  it("encendido: el asesor de pensiones sin R1 no precalifica, ni insertando directo en la base", async () => {
    await interruptor("encendido");
    expect(await permiso(S1, "precalificacion.retiro")).toBe(false);
    await expect(calculo(S1, "L97")).rejects.toThrow(/row-level security/);
    expect(await permiso(D, "precalificacion.retiro")).toBe(true);          // el Director y el analista no se bloquean
    expect(await permiso(A, "precalificacion.retiro")).toBe(true);
    expect((await calculo(A, "L73")).length).toBe(1);
  });
  it("con R1 precalifica Ley 97 pero no Ley 73; con R2, también Ley 73 (R2 incluye los permisos de R1)", async () => {
    await interruptor("encendido");
    await db.query("INSERT INTO cap_certificaciones (usuario_id, ruta, vence_at) VALUES ($1, 'R1', current_date + 365)", [S1]);
    expect(await permiso(S1, "precalificacion.retiro")).toBe(true);
    expect((await calculo(S1, "L97")).length).toBe(1);
    await expect(calculo(S1, "L73")).rejects.toThrow(/row-level security/);
    await db.query("INSERT INTO cap_certificaciones (usuario_id, ruta, vence_at) VALUES ($1, 'R2', current_date + 365)", [S2]);
    expect(await permiso(S2, "precalificacion.retiro")).toBe(true);
    expect(await permiso(S2, "precalificacion.retiro.L73")).toBe(true);
    expect((await como<{ permiso: string }>(S2, "SELECT permiso FROM v_permisos_usuario ORDER BY 1")).map((r) => r.permiso)).toContain("precalificacion.retiro.L73");
  });
  it("una certificación vencida ya no da permisos", async () => {
    await interruptor("encendido");
    await db.query("UPDATE cap_certificaciones SET vence_at = current_date - 1 WHERE usuario_id = $1 AND ruta = 'R1'", [S1]);
    expect(await permiso(S1, "precalificacion.retiro")).toBe(false);
  });
});

describe("excepciones temporales (3.2)", () => {
  it("solo el Director las da, con motivo y máximo 30 días; dan el permiso mientras duran", async () => {
    await interruptor("encendido");
    await expect(como(S1, "INSERT INTO cap_excepciones (usuario_id, ruta, hasta, motivo) VALUES ($1, 'R1', current_date + 5, 'Me la doy yo')", [S1])).rejects.toThrow();
    await expect(como(D, "INSERT INTO cap_excepciones (usuario_id, ruta, hasta, motivo) VALUES ($1, 'R1', current_date + 45, 'Demasiado tiempo')", [S1])).rejects.toThrow();
    await expect(como(D, "INSERT INTO cap_excepciones (usuario_id, ruta, hasta, motivo) VALUES ($1, 'R1', current_date + 5, 'x')", [S1])).rejects.toThrow();
    await como(D, "INSERT INTO cap_excepciones (usuario_id, ruta, hasta, motivo) VALUES ($1, 'R1', current_date + 10, 'Cierra un caso acompañado')", [S1]);
    expect(await permiso(S1, "precalificacion.retiro")).toBe(true);
    await como(D, "UPDATE cap_excepciones SET archivado_at = now() WHERE usuario_id = $1", [S1]);
    expect(await permiso(S1, "precalificacion.retiro")).toBe(false);
    await expect(como(D, "DELETE FROM cap_excepciones WHERE usuario_id = $1", [S1])).rejects.toThrow(/permission denied/);
  });
});

describe("simulador", () => {
  it("nadie escribe sus propios intentos del simulador; cada quien ve los suyos", async () => {
    await expect(como(S1, "INSERT INTO cap_casos_intentos (usuario_id, caso, version, captura, aprobado) VALUES ($1, 'C-R01', 1, '{}', true)", [S1])).rejects.toThrow(/permission denied/);
    await db.query("INSERT INTO cap_casos_intentos (usuario_id, caso, version, captura, aprobado) VALUES ($1, 'C-R01', 1, '{}', true)", [S1]);
    expect(await como(S1, "SELECT id FROM cap_casos_intentos WHERE usuario_id = $1", [S1])).toHaveLength(1);
    expect(await como(S2, "SELECT id FROM cap_casos_intentos WHERE usuario_id = $1", [S1])).toHaveLength(0);
  });
});

describe("permiso de otra persona (asignar casos de pensión)", () => {
  it("el Director y el analista consultan el permiso de un asesor; el asesor no consulta el de otro", async () => {
    await interruptor("encendido");
    expect((await como<{ ok: boolean | null }>(D, "SELECT app.permiso_de_otro($1, 'prospecto.pension.recibir') AS ok", [S2]))[0].ok).toBe(false);
    await db.query("INSERT INTO cap_certificaciones (usuario_id, ruta, vence_at) VALUES ($1, 'P1', current_date + 365)", [S2]);
    expect((await como<{ ok: boolean | null }>(A, "SELECT app.permiso_de_otro($1, 'prospecto.pension.recibir') AS ok", [S2]))[0].ok).toBe(true);
    expect((await como<{ ok: boolean | null }>(S1, "SELECT app.permiso_de_otro($1, 'prospecto.pension.recibir') AS ok", [S2]))[0].ok).toBeNull();
    await expect(como(S1, "SELECT app.permiso_de($1, 'x')", [S2])).rejects.toThrow(/permission denied/);
  });
});
