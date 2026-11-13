// Gerente de campo: da de alta en su tabla y ve solo lo suyo; nunca toca personas ni casos; no se autoverifica ni se
// autopaga; el analista verifica y aprueba días; solo el Director registra pagos; fotos en su carpeta; nadie borra.
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL = process.env.DATABASE_URL_TEST ?? "postgresql://rpd:rpd@localhost:5432/rpd_test";
const db = new pg.Client({ connectionString: URL });
const D = randomUUID(), A = randomUUID(), G1 = randomUUID(), G2 = randomUUID();
const tel = () => `+5255${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;

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

let p1 = "", j1 = "";
const W1 = tel();
beforeAll(async () => {
  await db.connect();
  for (const [uid, rol] of [[D, "director"], [A, "asesor"], [G1, "campo"], [G2, "campo"]] as const) {
    const email = `${rol}-${uid.slice(0, 6)}@campo.mx`;
    await db.query("INSERT INTO auth.users (id, email) VALUES ($1, $2)", [uid, email]);
    await db.query("INSERT INTO usuarios (id, nombre, email, rol, updated_at) VALUES ($1, $2, $3, $4, now())", [uid, `C ${rol}`, email, rol]);
  }
});
afterAll(async () => { await db.end(); });

describe("prospectos de campo", () => {
  it("el gerente da de alta y ve solo los suyos; no puede darse por verificado", async () => {
    p1 = (await como<{ id: string }>(G1, "INSERT INTO campo_prospectos (nombre, whatsapp, municipio, lugar) VALUES ('Juan Pérez', $1, 'Jiutepec', 'Plaza') RETURNING id", [W1]))[0].id;
    await expect(como(G1, "INSERT INTO campo_prospectos (nombre, whatsapp, municipio, estado) VALUES ('X Y', $1, 'Cuautla', 'verificado')", [tel()])).rejects.toThrow(/permission denied/);
    await expect(como(G1, "INSERT INTO campo_prospectos (gerente_id, nombre, whatsapp, municipio) VALUES ($1, 'X Y', $2, 'Cuautla')", [G2, tel()])).rejects.toThrow(/permission denied/);
    expect(await como(G1, "SELECT id FROM campo_prospectos WHERE id = $1", [p1])).toHaveLength(1);
    expect(await como(G2, "SELECT id FROM campo_prospectos WHERE id = $1", [p1])).toHaveLength(0);
    expect(await como(G1, "UPDATE campo_prospectos SET estado = 'rechazado', motivo_rechazo = 'xxx' WHERE id = $1 RETURNING id", [p1])).toHaveLength(0);
    await expect(como(A, "INSERT INTO campo_prospectos (nombre, whatsapp, municipio) VALUES ('X Y', $1, 'Cuautla')", [tel()])).rejects.toThrow();
  });
  it("el gerente no ve ni crea clientes (personas y casos)", async () => {
    expect(await como(G1, "SELECT id FROM personas LIMIT 5")).toHaveLength(0);
    await expect(como(G1, "INSERT INTO personas (nombre, telefono, origen, owner_id, updated_at) VALUES ('Z', '7770000000', 'campo', $1, now())", [G1])).rejects.toThrow();
  });
  it("el aviso de teléfono repetido incluye los prospectos de campo vivos", async () => {
    expect((await como<{ r: boolean }>(G2, "SELECT app.telefono_registrado($1) AS r", [W1]))[0].r).toBe(true);
    expect((await como<{ r: boolean }>(G2, "SELECT app.telefono_registrado($1) AS r", [tel()]))[0].r).toBe(false);
  });
  it("el analista verifica (con monto) o rechaza con motivo; el pago lo liga solo el Director", async () => {
    await expect(como(A, "UPDATE campo_prospectos SET estado = 'verificado' WHERE id = $1", [p1])).rejects.toThrow();
    expect(await como(A, "UPDATE campo_prospectos SET estado = 'verificado', verificado_por = $2, verificado_at = now(), monto_cent = 2000 WHERE id = $1 RETURNING id", [p1, A])).toHaveLength(1);
    const otro = (await como<{ id: string }>(G1, "INSERT INTO campo_prospectos (nombre, whatsapp, municipio) VALUES ('Ana Ruiz', $1, 'Cuautla') RETURNING id", [tel()]))[0].id;
    await expect(como(A, "UPDATE campo_prospectos SET estado = 'rechazado' WHERE id = $1", [otro])).rejects.toThrow();
    expect(await como(A, "UPDATE campo_prospectos SET estado = 'rechazado', motivo_rechazo = 'Número que no existe' WHERE id = $1 RETURNING id", [otro])).toHaveLength(1);
    await expect(como(D, "DELETE FROM campo_prospectos WHERE id = $1", [otro])).rejects.toThrow(/permission denied/);
  });
});

describe("días trabajados y pagos", () => {
  it("la foto va en la carpeta del propio gerente; un día cuenta una vez", async () => {
    j1 = (await como<{ id: string }>(G1, "INSERT INTO campo_jornadas (municipio, lugar, foto_path) VALUES ('Jiutepec', 'Plaza Cívica', $1) RETURNING id", [`${G1}/${randomUUID()}.jpg`]))[0].id;
    await expect(como(G1, "INSERT INTO campo_jornadas (municipio, lugar, foto_path) VALUES ('Jiutepec', 'Mercado', $1)", [`${G1}/${randomUUID()}.jpg`])).rejects.toThrow();
    await expect(como(G2, "INSERT INTO campo_jornadas (municipio, lugar, foto_path) VALUES ('Cuautla', 'Centro', $1)", [`${G1}/${randomUUID()}.jpg`])).rejects.toThrow();
    expect(await como(G2, "SELECT id FROM campo_jornadas WHERE id = $1", [j1])).toHaveLength(0);
    expect(await como(G1, "UPDATE campo_jornadas SET estado = 'aprobada', revisada_at = now(), monto_cent = 1 WHERE id = $1 RETURNING id", [j1])).toHaveLength(0);
    expect(await como(A, "UPDATE campo_jornadas SET estado = 'aprobada', revisada_por = $2, revisada_at = now(), monto_cent = 30000 WHERE id = $1 RETURNING id", [j1, A])).toHaveLength(1);
  });
  it("solo el Director registra el pago y lo liga; el gerente ve los suyos", async () => {
    const sql = "INSERT INTO campo_pagos (gerente_id, semana_inicio, semana_fin, fecha_pago, prospectos, dias, monto_prospectos_cent, monto_dias_cent, total_cent) VALUES ($1, '2026-11-16', '2026-11-22', '2026-11-25', 1, 1, 2000, 30000, 32000) RETURNING id";
    await expect(como(A, sql, [G1])).rejects.toThrow();
    await expect(como(G1, sql, [G1])).rejects.toThrow();
    await expect(como(D, sql.replace("32000", "1"), [G1])).rejects.toThrow();
    const pago = (await como<{ id: string }>(D, sql, [G1]))[0].id;
    await expect(como(A, "UPDATE campo_prospectos SET pago_id = $2 WHERE id = $1", [p1, pago])).rejects.toThrow(/row-level security/);
    expect(await como(D, "UPDATE campo_prospectos SET pago_id = $2 WHERE id = $1 RETURNING id", [p1, pago])).toHaveLength(1);
    expect(await como(D, "UPDATE campo_jornadas SET pago_id = $2 WHERE id = $1 RETURNING id", [j1, pago])).toHaveLength(1);
    expect(await como(G1, "SELECT id FROM campo_pagos WHERE id = $1", [pago])).toHaveLength(1);
    expect(await como(G2, "SELECT id FROM campo_pagos WHERE id = $1", [pago])).toHaveLength(0);
    expect(await como(A, "SELECT id FROM campo_pagos WHERE id = $1", [pago])).toHaveLength(0);
  });
});

describe("formulario público del gerente de campo (QR)", () => {
  it("cada gerente de campo tiene su código; se asigna al volverse gerente y se conserva", async () => {
    const [g] = (await db.query("SELECT campo_codigo FROM usuarios WHERE id = $1", [G1])).rows;
    expect(g.campo_codigo).toMatch(/^[a-z0-9]{8}$/);
    const [a] = (await db.query("SELECT campo_codigo FROM usuarios WHERE id = $1", [A])).rows;
    expect(a.campo_codigo).toBeNull();
    const nuevo = randomUUID();
    await db.query("INSERT INTO auth.users (id, email) VALUES ($1, $2)", [nuevo, `rol-${nuevo.slice(0, 6)}@campo.mx`]);
    await db.query("INSERT INTO usuarios (id, nombre, email, rol, updated_at) VALUES ($1, 'Cambio', $2, 'socio', now())", [nuevo, `rol-${nuevo.slice(0, 6)}@campo.mx`]);
    await db.query("UPDATE usuarios SET rol = 'campo' WHERE id = $1", [nuevo]);
    const [c] = (await db.query("SELECT campo_codigo FROM usuarios WHERE id = $1", [nuevo])).rows;
    expect(c.campo_codigo).toMatch(/^[a-z0-9]{8}$/);
  });
  it("un registro por formulario exige el aviso de privacidad; el gerente no puede hacerse pasar por formulario", async () => {
    await expect(db.query("INSERT INTO campo_prospectos (gerente_id, nombre, whatsapp, municipio, origen) VALUES ($1, 'Sin aviso', $2, 'Cuautla', 'formulario')", [G1, tel()])).rejects.toThrow(/privacidad/);
    const [ok] = (await db.query("INSERT INTO campo_prospectos (gerente_id, nombre, whatsapp, municipio, origen, privacidad_aceptada_at) VALUES ($1, 'Con aviso', $2, 'Cuautla', 'formulario', now()) RETURNING estado", [G1, tel()])).rows;
    expect(ok.estado).toBe("pendiente");
    await expect(como(G1, "INSERT INTO campo_prospectos (nombre, whatsapp, municipio, origen, privacidad_aceptada_at) VALUES ('Falso', $1, 'Cuautla', 'formulario', now())", [tel()])).rejects.toThrow(/permission denied/);
  });
  it("la CURP del formulario va completa (cifrada + hash + parcial) o no va; el gerente no puede escribirla", async () => {
    await expect(db.query("INSERT INTO campo_prospectos (gerente_id, nombre, whatsapp, municipio, origen, privacidad_aceptada_at, curp_hash) VALUES ($1, 'Media', $2, 'Cuautla', 'formulario', now(), 'abc')", [G1, tel()])).rejects.toThrow(/curp/);
    const [r] = (await db.query("INSERT INTO campo_prospectos (gerente_id, nombre, whatsapp, municipio, origen, privacidad_aceptada_at, curp_cifrada, curp_hash, curp_parcial) VALUES ($1, 'Completa', $2, 'Cuautla', 'formulario', now(), '\\x00', 'h1', 'PELJ••••06') RETURNING curp_parcial", [G1, tel()])).rows;
    expect(r.curp_parcial).toBe("PELJ••••06");
    await expect(como(G1, "INSERT INTO campo_prospectos (nombre, whatsapp, municipio, curp_hash) VALUES ('X', $1, 'Cuautla', 'h2')", [tel()])).rejects.toThrow(/permission denied/);
  });
});
