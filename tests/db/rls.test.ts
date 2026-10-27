// Criterios 14.2: un vendedor no ve casos ajenos ni el NSS completo, ni llamando directo
// a la base; ver un NSS completo deja renglón en la bitácora; nadie borra.
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL = process.env.DATABASE_URL_TEST ?? "postgresql://rpd:rpd@localhost:5432/rpd_test";
const db = new pg.Client({ connectionString: URL });

const id = () => randomUUID();
const U = { director: id(), asesor: id(), asesor2: id(), vendedor: id(), vendedor2: id(), socio: id(), sinMfa: id() };
const SOCIO = id();
const P1 = id(); // persona traída por el vendedor 1
const P2 = id(); // persona traída por el vendedor 2
const C1 = id(); // vendedor 1, asignado asesor 1
const C2 = id(); // vendedor 2, asignado asesor 2
const C3 = id(); // cartera del socio, asignado asesor 2
const C4 = id(); // bandeja general (sin asignar), vendedor 2

// Ejecuta como un usuario de la app: claims del JWT + rol authenticated, en transacción.
async function como<T = Record<string, unknown>>(uid: string, sql: string, params: unknown[] = [], aal = "aal2") {
  await db.query("BEGIN");
  try {
    await db.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, aal, role: "authenticated" })]);
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
  const roles: [string, string][] = [
    [U.director, "director"], [U.asesor, "asesor"], [U.asesor2, "asesor"],
    [U.vendedor, "vendedor"], [U.vendedor2, "vendedor"], [U.socio, "socio"], [U.sinMfa, "director"],
  ];
  await db.query("INSERT INTO socios (id, nombre, updated_at) VALUES ($1, 'Socio Cuautla', now())", [SOCIO]);
  for (const [uid, rol] of roles) {
    await db.query("INSERT INTO auth.users (id, email) VALUES ($1, $2)", [uid, `${rol}-${uid.slice(0, 4)}@prueba.mx`]);
    await db.query(
      "INSERT INTO usuarios (id, nombre, email, rol, socio_id, updated_at) VALUES ($1, $2, $3, $4, $5, now())",
      [uid, `Usuario ${rol}`, `${rol}-${uid.slice(0, 4)}@prueba.mx`, rol, rol === "socio" ? SOCIO : null],
    );
  }
  await db.query(
    `INSERT INTO personas (id, nombre, telefono, origen, owner_id, nss_cifrado, nss_hash, nss_ultimos4, updated_at)
     VALUES ($1, 'Juana', '7771112233', 'vendedor', $2, '\\x01aabbcc', 'hash-nss-p1', '1002', now()),
            ($3, 'Pedro', '7774445566', 'vendedor', $4, NULL, 'hash-nss-p2', '2003', now())`,
    [P1, U.vendedor, P2, U.vendedor2],
  );
  const caso = `INSERT INTO casos (id, persona_id, tipo_servicio, owner_id, vendedor_id, asignado_a, socio_id, updated_at)
                VALUES ($1, $2, 'RETIRO_DESEMPLEO', $3, $4, $5, $6, now())`;
  await db.query(caso, [C1, P1, U.vendedor, U.vendedor, U.asesor, null]);
  await db.query(caso, [C2, P2, U.vendedor2, U.vendedor2, U.asesor2, null]);
  await db.query(caso, [C3, P2, U.asesor2, null, U.asesor2, SOCIO]);
  await db.query(caso, [C4, P2, U.vendedor2, U.vendedor2, null, null]);
  const tipo = (await db.query("SELECT id FROM tipos_documento LIMIT 1")).rows[0].id;
  await db.query("INSERT INTO documentos (caso_id, tipo_id, updated_at) VALUES ($1, $2, now())", [C1, tipo]);
  await db.query("INSERT INTO datos_afore (caso_id, clabe_cifrada, clabe_ultimos4, updated_at) VALUES ($1, '\\x01ff', '1234', now())", [C1]);
});

afterAll(() => db.end());

const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort();

describe("2FA obligatorio", () => {
  it("sin aal2 ni el Director ve casos", async () => {
    expect(await como(U.sinMfa, "SELECT id FROM casos", [], "aal1")).toHaveLength(0);
  });
  it("con aal2 el Director ve todos", async () => {
    const r = await como<{ id: string }>(U.director, "SELECT id FROM casos WHERE id = ANY($1)", [[C1, C2, C3, C4]]);
    expect(r).toHaveLength(4);
  });
});

describe("visibilidad por rol (sección 3)", () => {
  it("el vendedor solo ve sus casos", async () => {
    expect(ids(await como<{ id: string }>(U.vendedor, "SELECT id FROM casos"))).toEqual([C1]);
  });
  it("el asesor ve sus asignados y la bandeja general, no los de otro asesor", async () => {
    expect(ids(await como<{ id: string }>(U.asesor, "SELECT id FROM casos"))).toEqual([C1, C4].sort());
  });
  it("el socio solo ve su cartera", async () => {
    expect(ids(await como<{ id: string }>(U.socio, "SELECT id FROM casos"))).toEqual([C3]);
  });
  it("el vendedor no ve personas ajenas", async () => {
    expect(ids(await como<{ id: string }>(U.vendedor, "SELECT id FROM personas"))).toEqual([P1]);
  });
  it("el vendedor no entra al expediente ni a los documentos", async () => {
    expect(await como(U.vendedor, "SELECT id FROM documentos")).toHaveLength(0);
    expect(await como(U.asesor, "SELECT id FROM documentos")).toHaveLength(1);
  });
  it("el vendedor no puede pasarle su caso a otro vendedor", async () => {
    await expect(como(U.vendedor, "UPDATE casos SET vendedor_id = $1 WHERE id = $2", [U.vendedor2, C1])).rejects.toThrow(/row-level security/);
  });
  it("el vendedor no puede tocar casos ajenos (0 filas afectadas)", async () => {
    await como(U.vendedor, "UPDATE casos SET prioridad = 'alta' WHERE id = $1", [C2]);
    const r = await db.query("SELECT prioridad FROM casos WHERE id = $1", [C2]);
    expect(r.rows[0].prioridad).toBe("normal");
  });
});

describe("datos sensibles (sección 12)", () => {
  it("nadie lee la columna cifrada directo, ni el Director", async () => {
    await expect(como(U.vendedor, "SELECT nss_cifrado FROM personas")).rejects.toThrow(/permission denied/);
    await expect(como(U.director, "SELECT nss_cifrado FROM personas")).rejects.toThrow(/permission denied/);
    await expect(como(U.asesor, "SELECT clabe_cifrada FROM datos_afore")).rejects.toThrow(/permission denied/);
  });
  it("el vendedor sí ve el NSS enmascarado (últimos 4)", async () => {
    const r = await como<{ nss_ultimos4: string }>(U.vendedor, "SELECT nss_ultimos4 FROM personas WHERE id = $1", [P1]);
    expect(r[0].nss_ultimos4).toBe("1002");
  });
  it("ver el NSS completo deja un renglón en la bitácora", async () => {
    const antes = Number((await db.query("SELECT count(*) FROM auditoria.auditoria WHERE accion = 'VER_SENSIBLE' AND registro_id = $1", [P1])).rows[0].count);
    const r = await como<{ v: Buffer }>(U.asesor, "SELECT app.ver_dato_sensible('personas', $1, 'nss') AS v", [P1]);
    expect(Buffer.from(r[0].v).toString("hex")).toBe("01aabbcc");
    const fila = (await db.query("SELECT usuario_id, campo FROM auditoria.auditoria WHERE accion = 'VER_SENSIBLE' AND registro_id = $1 ORDER BY id DESC LIMIT 1", [P1])).rows[0];
    expect(fila).toEqual({ usuario_id: U.asesor, campo: "nss" });
    const despues = Number((await db.query("SELECT count(*) FROM auditoria.auditoria WHERE accion = 'VER_SENSIBLE' AND registro_id = $1", [P1])).rows[0].count);
    expect(despues).toBe(antes + 1);
  });
  it("el vendedor no puede ver el NSS completo ni con la función", async () => {
    await expect(como(U.vendedor, "SELECT app.ver_dato_sensible('personas', $1, 'nss')", [P1])).rejects.toThrow(/rol no puede/);
  });
  it("el socio no puede ver la CLABE de un caso ajeno", async () => {
    const afore = (await db.query("SELECT id FROM datos_afore WHERE caso_id = $1", [C1])).rows[0].id;
    await expect(como(U.socio, "SELECT app.ver_dato_sensible('datos_afore', $1, 'clabe')", [afore])).rejects.toThrow(/Sin acceso/);
  });
  it("detectar duplicado no revela a quién pertenece si no lo puedes ver", async () => {
    const r = await como<{ campo: string; persona_id: string | null; visible: boolean }>(
      U.vendedor2, "SELECT * FROM app.buscar_duplicados(NULL, NULL, 'hash-nss-p1')");
    expect(r).toEqual([{ campo: "nss", persona_id: null, visible: false }]);
  });
});

describe("nadie borra; la bitácora no se edita", () => {
  it("el Director no puede borrar un caso desde la app", async () => {
    await expect(como(U.director, "DELETE FROM casos WHERE id = $1", [C4])).rejects.toThrow(/permission denied/);
  });
  it("la bitácora no se modifica ni con superusuario", async () => {
    await expect(db.query("UPDATE auditoria.auditoria SET accion = 'X' WHERE id = (SELECT max(id) FROM auditoria.auditoria)")).rejects.toThrow(/bitácora/);
    await expect(db.query("DELETE FROM auditoria.auditoria")).rejects.toThrow(/bitácora/);
  });
  it("solo el Director lee la bitácora", async () => {
    expect(await como(U.asesor, "SELECT id FROM auditoria.auditoria LIMIT 1")).toHaveLength(0);
    expect((await como(U.director, "SELECT id FROM auditoria.auditoria LIMIT 1")).length).toBe(1);
  });
  it("un cambio de SBC queda resaltado con quién lo hizo", async () => {
    await como(U.asesor, "INSERT INTO datos_imss (caso_id, sbc_ultimo, updated_at) VALUES ($1, 500, now())", [C1]);
    await como(U.asesor, "UPDATE datos_imss SET sbc_ultimo = 650 WHERE caso_id = $1", [C1]);
    const f = (await db.query(
      "SELECT campos_cambiados, resaltado, usuario_id FROM auditoria.auditoria WHERE tabla = 'datos_imss' AND accion = 'UPDATE' ORDER BY id DESC LIMIT 1")).rows[0];
    expect(f).toMatchObject({ campos_cambiados: ["sbc_ultimo"], resaltado: true, usuario_id: U.asesor });
  });
});

describe("decisiones del 27-oct", () => {
  it("dictamen manual: el vendedor no puede dictaminar", async () => {
    await expect(como(U.vendedor, "UPDATE casos SET dictamen_manual = 'APTO', dictamen_manual_motivo = 'Cuenta con 2 años 11 meses, se revisó con la Afore' WHERE id = $1", [C1]))
      .rejects.toThrow(/Solo un asesor o el Director/);
  });
  it("dictamen manual: exige motivo de al menos 10 caracteres", async () => {
    await expect(como(U.asesor, "UPDATE casos SET dictamen_manual = 'APTO', dictamen_manual_motivo = 'ok' WHERE id = $1", [C1]))
      .rejects.toThrow(/casos_dictamen_con_motivo/);
  });
  it("dictamen manual: el asesor dictamina y queda quién y cuándo", async () => {
    await como(U.asesor, "UPDATE casos SET dictamen_manual = 'NO_APTO', dictamen_manual_motivo = 'Cuenta abierta hace 2 años; no completa 12 bimestres' WHERE id = $1", [C1]);
    const r = (await db.query("SELECT dictamen_manual, dictamen_manual_por, dictamen_manual_at IS NOT NULL AS con_fecha FROM casos WHERE id = $1", [C1])).rows[0];
    expect(r).toEqual({ dictamen_manual: "NO_APTO", dictamen_manual_por: U.asesor, con_fecha: true });
  });
  it("último retiro: 'con retiro' exige fecha; 'nunca retiró' queda verificado", async () => {
    await expect(como(U.asesor, "UPDATE datos_afore SET estado_ultimo_retiro = 'con_retiro' WHERE caso_id = $1", [C1]))
      .rejects.toThrow(/datos_afore_ultimo_retiro_coherente/);
    await como(U.asesor, "UPDATE datos_afore SET estado_ultimo_retiro = 'nunca_retiro' WHERE caso_id = $1", [C1]);
    const r = (await db.query("SELECT ultimo_retiro_verificado_por, ultimo_retiro_verificado_at IS NOT NULL AS con_fecha FROM datos_afore WHERE caso_id = $1", [C1])).rows[0];
    expect(r).toEqual({ ultimo_retiro_verificado_por: U.asesor, con_fecha: true });
  });
  it("tarea diaria: corre una vez por día de CDMX", async () => {
    await db.query("UPDATE parametros SET valor = '00:00' WHERE clave = 'HORA_ALERTAS_CDMX'");
    const pendientes = async () => (await db.query("SELECT tarea FROM app.tareas_pendientes_hoy()")).rows.map((r) => r.tarea);
    expect(await pendientes()).toContain("ALERTAS_DIARIAS");
    await db.query("INSERT INTO ejecuciones_tarea (id, tarea, fecha_cdmx, terminada_at) VALUES ($1, 'ALERTAS_DIARIAS', app.hoy_cdmx(), now())", [id()]);
    expect(await pendientes()).not.toContain("ALERTAS_DIARIAS");
    await db.query("UPDATE parametros SET valor = '07:00' WHERE clave = 'HORA_ALERTAS_CDMX'");
  });
});

describe("alta de prospectos", () => {
  it("un vendedor da de alta persona y caso en una transacción y ve lo que creó", async () => {
    await db.query("BEGIN");
    try {
      await db.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: U.vendedor2, aal: "aal2" })]);
      await db.query("SET LOCAL ROLE authenticated");
      const p = await db.query("INSERT INTO personas (nombre, origen, owner_id) VALUES ('Nueva', 'whatsapp', $1) RETURNING id", [U.vendedor2]);
      const c = await db.query(
        "INSERT INTO casos (persona_id, tipo_servicio, owner_id, vendedor_id) VALUES ($1, 'RETIRO_DESEMPLEO', $2, $2) RETURNING folio",
        [p.rows[0].id, U.vendedor2]);
      await db.query("INSERT INTO datos_imss (caso_id, fecha_baja) SELECT id, '2026-10-01' FROM casos WHERE folio = $1", [c.rows[0].folio]);
      expect(c.rows[0].folio).toMatch(/^RP-\d{4}$/);
    } finally {
      await db.query("ROLLBACK");
    }
  });
  it("un vendedor no puede dar de alta personas a nombre de otro", async () => {
    await expect(como(U.vendedor, "INSERT INTO personas (nombre, origen, owner_id) VALUES ('X', 'web', $1)", [U.vendedor2]))
      .rejects.toThrow(/row-level security/);
  });
});

describe("folio", () => {
  it("un vendedor crea su caso y recibe folio; anon no puede generar folios", async () => {
    const nuevo = await como<{ folio: string }>(U.vendedor,
      "INSERT INTO casos (persona_id, tipo_servicio, owner_id, vendedor_id) VALUES ($1, 'RETIRO_DESEMPLEO', $2, $2) RETURNING folio", [P1, U.vendedor]);
    expect(nuevo[0].folio).toMatch(/^RP-\d{4}$/);
    await db.query("BEGIN");
    await db.query("SET LOCAL ROLE anon");
    await expect(db.query("SELECT app.siguiente_folio()")).rejects.toThrow(/permission denied/);
    await db.query("ROLLBACK");
  });

  it("es consecutivo con el formato RP-0001", async () => {
    const r = (await db.query("SELECT folio FROM casos WHERE id = ANY($1) ORDER BY folio", [[C1, C2, C3, C4]])).rows.map((x) => x.folio);
    expect(r.every((f: string) => /^RP-\d{4}$/.test(f))).toBe(true);
    expect(new Set(r).size).toBe(4);
  });
});
