// Fase 3: dinero y comisiones. El vendedor no ve pagos ni cobros; cada beneficiario ve solo
// sus comisiones y liquidaciones; solo el Director liquida; nadie borra; los montos cuadran.
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL = process.env.DATABASE_URL_TEST ?? "postgresql://rpd:rpd@localhost:5432/rpd_test";
const db = new pg.Client({ connectionString: URL });

const id = () => randomUUID();
const U = { director: id(), asesor: id(), vendedor: id(), vendedor2: id(), socio: id(), socio2: id() };
const SOCIO = id(), SOCIO2 = id();
const P = id(), C1 = id(), C2 = id();
const PAGO = id(), COBRO = id();
const K_V1 = id(), K_V2 = id(), K_S = id();

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
  await db.query("INSERT INTO socios (id, nombre, updated_at) VALUES ($1, 'Socio Uno', now()), ($2, 'Socio Dos', now())", [SOCIO, SOCIO2]);
  const roles: [string, string, string | null][] = [
    [U.director, "director", null], [U.asesor, "asesor", null], [U.vendedor, "vendedor", null], [U.vendedor2, "vendedor", null],
    [U.socio, "socio", SOCIO], [U.socio2, "socio", SOCIO2],
  ];
  for (const [uid, rol, socio] of roles) {
    const email = `${rol}-${uid.slice(0, 6)}@dinero.mx`;
    await db.query("INSERT INTO auth.users (id, email) VALUES ($1, $2)", [uid, email]);
    await db.query("INSERT INTO usuarios (id, nombre, email, rol, socio_id, updated_at) VALUES ($1, $2, $3, $4, $5, now())", [uid, `U ${rol}`, email, rol, socio]);
  }
  await db.query("INSERT INTO personas (id, nombre, telefono, origen, owner_id, updated_at) VALUES ($1, 'Ana', '7770001111', 'vendedor', $2, now())", [P, U.vendedor]);
  const caso = "INSERT INTO casos (id, persona_id, tipo_servicio, owner_id, vendedor_id, asignado_a, socio_id, fecha_contrato, updated_at) VALUES ($1, $2, 'RETIRO_DESEMPLEO', $3, $4, $5, $6, '2026-10-01', now())";
  await db.query(caso, [C1, P, U.vendedor, U.vendedor, U.asesor, SOCIO]);
  await db.query(caso, [C2, P, U.vendedor2, U.vendedor2, U.asesor, null]);
  await db.query("INSERT INTO pagos_afore (id, caso_id, numero, fecha_deposito, monto_bruto, isr_retenido, monto_neto, updated_at) VALUES ($1, $2, 1, '2026-10-20', 10000, 0, 10000, now())", [PAGO, C1]);
  await db.query("INSERT INTO cobros (id, caso_id, pago_afore_id, honorario_total, subtotal, iva, estado, fecha_cobro, metodo, updated_at) VALUES ($1, $2, $3, 3000, 2586.21, 413.79, 'cobrado', '2026-10-22', 'transferencia', now())", [COBRO, C1, PAGO]);
  const esquema = (await db.query("SELECT id FROM esquemas_comision WHERE tipo = 'vendedor' LIMIT 1")).rows[0].id;
  const com = `INSERT INTO comisiones (id, caso_id, esquema_id, tipo, beneficiario_tipo, beneficiario_id, base, regla_aplicada, monto, estado, fecha_devengo, clave, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, 10000, 'prueba', $7, 'devengada', '2026-10-22', $8, now())`;
  await db.query(com, [K_V1, C1, esquema, "vendedor", "usuario", U.vendedor, 500, "vendedor:pago:1"]);
  await db.query(com, [K_V2, C2, esquema, "vendedor", "usuario", U.vendedor2, 250, "vendedor:pago:1"]);
  await db.query(com, [K_S, C1, esquema, "socio", "socio", SOCIO, 834.48, "socio:cobro:x"]);
});

afterAll(() => db.end());

describe("pagos y cobros (sección 3: el vendedor no entra al dinero)", () => {
  it("el vendedor no ve pagos ni cobros, ni de su propio caso", async () => {
    expect(await como(U.vendedor, "SELECT id FROM pagos_afore WHERE caso_id = $1", [C1])).toHaveLength(0);
    expect(await como(U.vendedor, "SELECT id FROM cobros WHERE caso_id = $1", [C1])).toHaveLength(0);
  });
  it("el vendedor no puede registrar un pago", async () => {
    await expect(como(U.vendedor, "INSERT INTO pagos_afore (caso_id, numero, fecha_deposito, monto_bruto, monto_neto, updated_at) VALUES ($1, 2, '2026-10-25', 1, 1, now())", [C1])).rejects.toThrow();
  });
  it("el asesor y el socio de la cartera sí ven el cobro; el otro socio no", async () => {
    expect(await como(U.asesor, "SELECT id FROM cobros WHERE caso_id = $1", [C1])).toHaveLength(1);
    expect(await como(U.socio, "SELECT id FROM cobros WHERE caso_id = $1", [C1])).toHaveLength(1);
    expect(await como(U.socio2, "SELECT id FROM cobros WHERE caso_id = $1", [C1])).toHaveLength(0);
  });
  it("el IVA siempre cuadra y un cobro cancelado lleva motivo", async () => {
    await expect(db.query("INSERT INTO cobros (caso_id, honorario_total, subtotal, iva, updated_at) VALUES ($1, 3000, 2586.21, 413.00, now())", [C1])).rejects.toThrow(/cobros_iva_cuadra/);
    await expect(db.query("UPDATE cobros SET estado = 'cancelado' WHERE id = $1", [COBRO])).rejects.toThrow(/cobros_cancelado_con_motivo/);
  });
  it("la clave de comisión viva no se repite en el caso", async () => {
    const esquema = (await db.query("SELECT id FROM esquemas_comision LIMIT 1")).rows[0].id;
    await expect(db.query(`INSERT INTO comisiones (caso_id, esquema_id, tipo, beneficiario_tipo, beneficiario_id, base, regla_aplicada, monto, clave, updated_at)
      VALUES ($1, $2, 'vendedor', 'usuario', $3, 1, 'x', 1, 'vendedor:pago:1', now())`, [C1, esquema, U.vendedor])).rejects.toThrow(/comisiones_caso_clave_viva/);
  });
});

describe("comisiones (9.3: cada beneficiario ve su estado de cuenta y nada más)", () => {
  it("cada vendedor ve solo las suyas; el socio solo las del socio", async () => {
    expect((await como<{ id: string }>(U.vendedor, "SELECT id FROM comisiones WHERE id = ANY($1)", [[K_V1, K_V2, K_S]])).map((r) => r.id)).toEqual([K_V1]);
    expect((await como<{ id: string }>(U.socio, "SELECT id FROM comisiones WHERE id = ANY($1)", [[K_V1, K_V2, K_S]])).map((r) => r.id)).toEqual([K_S]);
    expect(await como(U.socio2, "SELECT id FROM comisiones WHERE id = ANY($1)", [[K_V1, K_V2, K_S]])).toHaveLength(0);
    expect(await como(U.director, "SELECT id FROM comisiones WHERE id = ANY($1)", [[K_V1, K_V2, K_S]])).toHaveLength(3);
  });
  it("ni el asesor ni el vendedor pueden cambiar una comisión", async () => {
    expect(await como(U.asesor, "UPDATE comisiones SET monto = 1 WHERE id = $1 RETURNING id", [K_V1])).toHaveLength(0);
    expect(await como(U.vendedor, "UPDATE comisiones SET estado = 'pagada', fecha_pago = '2026-10-27' WHERE id = $1 RETURNING id", [K_V1])).toHaveLength(0);
  });
  it("solo el Director liquida; cada quien ve sus liquidaciones; nadie borra", async () => {
    await expect(como(U.asesor, "INSERT INTO liquidaciones (beneficiario_tipo, beneficiario_id, periodo, total, fecha_pago, metodo) VALUES ('usuario', $1, '2026-10-01', 500, '2026-10-27', 'transferencia')", [U.vendedor])).rejects.toThrow();
    const [l] = await como<{ id: string }>(U.director, "INSERT INTO liquidaciones (beneficiario_tipo, beneficiario_id, periodo, total, fecha_pago, metodo) VALUES ('usuario', $1, '2026-10-01', 500, '2026-10-27', 'transferencia') RETURNING id", [U.vendedor]);
    await como(U.director, "UPDATE comisiones SET estado = 'pagada', fecha_pago = '2026-10-27', liquidacion_id = $2 WHERE id = $1", [K_V1, l.id]);
    expect(await como(U.vendedor, "SELECT id FROM liquidaciones WHERE id = $1", [l.id])).toHaveLength(1);
    expect(await como(U.vendedor2, "SELECT id FROM liquidaciones WHERE id = $1", [l.id])).toHaveLength(0);
    await expect(como(U.director, "DELETE FROM liquidaciones WHERE id = $1", [l.id])).rejects.toThrow(/permission denied/);
    await expect(como(U.director, "DELETE FROM comisiones WHERE id = $1", [K_V1])).rejects.toThrow(/permission denied/);
  });
  it("14.2: el estado de cuenta del mes cuadra al centavo con la suma de sus casos", async () => {
    const [r] = await como<{ total: string; suma: string }>(U.director, `
      SELECT l.total::text AS total, (SELECT sum(monto) FROM comisiones c WHERE c.liquidacion_id = l.id)::text AS suma
      FROM liquidaciones l WHERE l.beneficiario_id = $1`, [U.vendedor]);
    expect(r.total).toBe(r.suma);
  });
  it("la liquidación queda en la bitácora", async () => {
    const r = await db.query("SELECT count(*)::int AS n FROM auditoria.auditoria WHERE tabla = 'liquidaciones'");
    expect(r.rows[0].n).toBeGreaterThan(0);
  });
});
