// Next 16: `proxy` reemplaza a `middleware`. Refresca la sesión de Supabase y manda a
// /login o /mfa a quien no tenga sesión con 2FA. La autorización real la hace RLS.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { modoDemo } from "@/lib/auth/demo";

// /api/calendario/<token>: suscripción .ics; la autoriza el token, no la sesión.
const PUBLICAS = ["/login", "/auth/callback", "/api/cron", "/api/leads", "/api/calendario/"];
// Con sesión pero sin 2FA solo se puede inscribir el segundo factor o definir contraseña.
const SIN_2FA = ["/mfa", "/contrasena"];

export async function proxy(request: NextRequest) {
  if (modoDemo()) return NextResponse.next();

  let respuesta = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => request.cookies.set(name, value));
        respuesta = NextResponse.next({ request });
        lista.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const ruta = request.nextUrl.pathname;

  if (PUBLICAS.some((p) => ruta.startsWith(p))) return respuesta;

  const ir = (destino: string) => {
    const url = request.nextUrl.clone();
    url.pathname = destino;
    url.search = "";
    const r = NextResponse.redirect(url);
    respuesta.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };

  if (!claims) return ir("/login");
  if (claims.aal !== "aal2" && !SIN_2FA.includes(ruta)) return ir("/mfa");
  if (claims.aal === "aal2" && (ruta === "/mfa" || ruta === "/")) return ir("/hoy");
  return respuesta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|brand/|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
