// Dirección pública del panel (ligas en correos, calendario e instrucciones). Se fija con APP_URL en
// Vercel; mientras el dominio propio no esté listo, se usa la de Vercel.
export const urlApp = () => (process.env.APP_URL ?? "https://rpd-control.vercel.app").replace(/\/+$/, "");
/** La misma dirección sin «https://», para mostrarla en texto. */
export const dominioApp = () => urlApp().replace(/^https?:\/\//, "");
