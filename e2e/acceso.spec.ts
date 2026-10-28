import { expect, test } from "@playwright/test";

// Sin sesión no se ve ninguna pantalla interna: el proxy manda a /login.
test("sin sesión, cualquier módulo redirige al inicio de sesión", async ({ page }) => {
  for (const ruta of ["/", "/hoy", "/casos", "/configuracion", "/casos/123"]) {
    await page.goto(ruta);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test("el inicio de sesión lleva la marca y avisa del segundo factor", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Inicia sesión" })).toBeVisible();
  await expect(page.getByLabel("RetiroPorDesempleo.com")).toBeVisible();
  await expect(page.getByText("código de tu app autenticadora")).toBeVisible();
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(ancho).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("el aviso de cierre por inactividad se muestra", async ({ page }) => {
  await page.goto("/login?motivo=inactividad");
  await expect(page.getByText("30 minutos sin actividad")).toBeVisible();
});

test("la tarea diaria rechaza llamadas sin el secreto", async ({ request }) => {
  const r = await request.post("/api/cron/diaria?tarea=ALERTAS_DIARIAS");
  expect(r.status()).toBe(401);
});

test("definir contraseña exige sesión; la liga sin tokens se rechaza", async ({ page }) => {
  await page.goto("/contrasena");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/auth/callback");
  await expect(page.getByText("Esta liga no es válida")).toBeVisible();
});

test("se puede pedir la liga para definir contraseña", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Olvidaste tu contraseña/ }).click();
  await expect(page.getByRole("heading", { name: "Define tu contraseña" })).toBeVisible();
});

test("el almacén de demostración no existe fuera del modo demostración", async ({ request }) => {
  const r = await request.get("/api/demo/almacen?ruta=x&firma=y", { maxRedirects: 0 });
  expect(r.status()).not.toBe(200);
  const put = await request.put("/api/demo/almacen?ruta=x&firma=y", { data: "hola", maxRedirects: 0 });
  expect(put.status()).not.toBe(200);
});

test("dinero, comisiones, reportes y sus exportaciones exigen sesión", async ({ page, request }) => {
  for (const ruta of ["/dinero", "/comisiones", "/comisiones/beneficiarios", "/reportes"]) {
    await page.goto(ruta);
    await expect(page).toHaveURL(/\/login$/);
  }
  for (const ruta of ["/api/exportar/dinero?mes=2026-10", "/api/exportar/reporte?clave=todos", "/api/comisiones/estado-cuenta?benef=x&mes=2026-10"]) {
    const r = await request.get(ruta, { maxRedirects: 0 });
    expect(r.status(), ruta).toBe(307);
    expect(r.headers().location).toMatch(/\/login$/);
  }
});

test("el formulario del sitio exige firma", async ({ request }) => {
  const r = await request.post("/api/leads", { data: { nombre: "Ana" } });
  expect(r.status()).toBe(401);
});
