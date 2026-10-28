// Fase 4: ligas privadas del calendario. Cada usuario solo ve y revoca la suya; el HMAC del
// token no se lee desde la app; una sola liga viva por usuario; nadie borra.
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL = process.env.DATABASE_URL_TEST ?? "postgresql://rpd:rpd@localhost:5432/rpd_test";
const db = new pg.Client({ connectionString: URL });
const A = randomUUID(), B = randomUUID();

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
  for (const [uid, rol] of [[A, "asesor"], [B, "vendedor"]]) {
    const email = `${rol}-${uid.slice(0, 6)}@cal.mx`;
    await db.query("INSERT INTO auth.users (id, email) VALUES ($1, $2)", [uid, email]);
    await db.query("INSERT INTO usuarios (id, nombre, email, rol, updated_at) VALUES ($1, $2, $3, $4, now())", [uid, `U ${rol}`, email, rol]);
  }
});
afterAll(() => db.end());

describe("ligas del calendario", () => {
  it("cada quien crea y ve solo la suya; el hash no se lee", async () => {
    await como(A, "INSERT INTO calendario_tokens (usuario_id, token_hash) VALUES ($1, 'h-a')", [A]);
    await expect(como(B, "INSERT INTO calendario_tokens (usuario_id, token_hash) VALUES ($1, 'h-x')", [A])).rejects.toThrow();
    expect(await como(B, "SELECT id FROM calendario_tokens WHERE usuario_id = $1", [A])).toHaveLength(0);
    expect(await como(A, "SELECT id FROM calendario_tokens WHERE usuario_id = $1", [A])).toHaveLength(1);
    await expect(como(A, "SELECT token_hash FROM calendario_tokens")).rejects.toThrow(/permission denied/);
  });
  it("una sola liga viva; revocar permite otra; nadie borra", async () => {
    await expect(como(A, "INSERT INTO calendario_tokens (usuario_id, token_hash) VALUES ($1, 'h-a2')", [A])).rejects.toThrow(/calendario_tokens_vivo/);
    expect(await como(B, "UPDATE calendario_tokens SET revocado_at = now() WHERE usuario_id = $1 RETURNING id", [A])).toHaveLength(0);
    await como(A, "UPDATE calendario_tokens SET revocado_at = now() WHERE usuario_id = $1 AND revocado_at IS NULL", [A]);
    await como(A, "INSERT INTO calendario_tokens (usuario_id, token_hash) VALUES ($1, 'h-a2')", [A]);
    await expect(como(A, "DELETE FROM calendario_tokens WHERE usuario_id = $1", [A])).rejects.toThrow(/permission denied/);
  });
});
