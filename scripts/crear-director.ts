// Crea el primer usuario (Director) en Supabase Auth y en la tabla `usuarios`.
// Uso: npx tsx scripts/crear-director.ts correo@dominio "Nombre completo"
// Requiere NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY y DIRECT_URL en el entorno.
// Supabase manda un correo de invitación; al entrar, la app pide inscribir el 2FA.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const [email, nombre] = process.argv.slice(2);
  if (!email || !nombre) throw new Error('Uso: npx tsx scripts/crear-director.ts correo "Nombre completo"');

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email);
  if (error) throw error;

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }) });
  await prisma.usuario.upsert({
    where: { id: data.user.id },
    update: { nombre, rol: "director", activo: true },
    create: { id: data.user.id, email, nombre, rol: "director" },
  });
  await prisma.$disconnect();
  console.log(`Director creado: ${email}. Revisa tu correo para aceptar la invitación.`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
