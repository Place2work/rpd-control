// Pago esperado de la Afore → honorario proyectado; luego el pago real ya viene con el monto. Datos FICTICIOS.
// Uso: RPD_DEMO_SIN_AUTH=1 npx next dev -p 3100, y luego CASO=<id> node scripts/probar-pago-esperado.cjs
const { chromium } = require('playwright');
const B = 'http://localhost:3100';
const CASO = process.env.CASO;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1600 } });
  const errores = []; p.on('pageerror', (e) => errores.push(e.message));
  try {
    await p.goto(`${B}/casos/${CASO}?tab=dinero`, { waitUntil: 'networkidle' });
    await p.fill('#monto_esperado', '35,193'); await p.fill('#fecha_estimada', '2026-11-20');
    await p.getByRole('button', { name: 'Guardar monto esperado' }).click();
    await p.getByText(/honorario proyectado/).first().waitFor();
    await p.reload({ waitUntil: 'networkidle' });
    console.log('tarjeta:', (await p.getByRole('heading', { name: 'Pago esperado de la Afore' }).locator('xpath=ancestor::div[contains(@class,"rounded")][1]').innerText()).split('\n').slice(0, 3).join(' | '));
    console.log('pago real prellenado:', await p.inputValue('#monto_bruto'), '· etapa sin cambio:', (await p.locator('header').first().innerText()).match(/Prospecto|Pagado por Afore/)?.[0]);
    await p.goto(`${B}/dinero`, { waitUntil: 'networkidle' });
    console.log('Dinero:', (await p.getByRole('heading', { name: 'Honorario proyectado' }).locator('xpath=ancestor::div[contains(@class,"rounded")][1]').innerText()).replace(/\n+/g, ' | '));
    await p.goto(`${B}/hoy`, { waitUntil: 'networkidle' });
    console.log('Hoy:', (await p.getByText('Por cobrar', { exact: true }).locator('..').innerText()).replace(/\n+/g, ' | '));
  } catch (e) { console.log('FALLÓ:', e.message.split('\n')[0]); await p.screenshot({ path: 'fallo.png', fullPage: true }); }
  console.log('errores de página:', errores.length ? errores : 'ninguno');
  await b.close();
})();
