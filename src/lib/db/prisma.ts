// Acceso a datos (hallazgo H1). Prisma se conecta con un rol privilegiado que se salta RLS,
// así que TODA consulta de un usuario pasa por conUsuario(): abre una transacción, carga los
// claims verificados del JWT y baja a rol `authenticated`. Así aplican las políticas de
// 002_seguridad igual que si la consulta viniera de la API de Supabase.
import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

export type ClaimsUsuario = { sub: string; aal?: string; role?: string; email?: string; [k: string]: unknown };

// Las columnas cifradas no se pueden leer como `authenticated` (privilegio por columna).
// Se omiten siempre; el dato completo sale solo con verDatoSensible().
const OMITIR_CIFRADOS = {
  persona: { curp_cifrada: true, nss_cifrado: true },
  datosAfore: { clabe_cifrada: true },
  referidor: { clabe_cifrada: true },
  socio: { clabe_cifrada: true },
  parteCaso: { curp_cifrada: true, nss_cifrado: true },
} as const;

function crearCliente() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    omit: OMITIR_CIFRADOS,
  });
}

const global = globalThis as unknown as { __rpdPrisma?: ReturnType<typeof crearCliente> };
const base = global.__rpdPrisma ?? crearCliente();
if (process.env.NODE_ENV !== "production") global.__rpdPrisma = base;

export type Tx = Parameters<Parameters<typeof base.$transaction>[0]>[0];

export async function conUsuario<T>(claims: ClaimsUsuario, fn: (tx: Tx) => Promise<T>, ip?: string | null): Promise<T> {
  return base.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT
      set_config('request.jwt.claims', ${JSON.stringify(claims)}, true),
      set_config('request.headers', ${JSON.stringify({ "x-forwarded-for": ip ?? "" })}, true)`;
    await tx.$executeRawUnsafe("SET LOCAL ROLE authenticated");
    return fn(tx);
  });
}

// Sin RLS. Solo para procesos del servidor que no actúan como un usuario:
// tarea diaria, /api/leads y lectura de parámetros (no sensibles).
export const prismaSistema = base;
