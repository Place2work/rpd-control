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
