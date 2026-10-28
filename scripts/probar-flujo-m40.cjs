// Modalidad 40 (fase 4) con datos FICTICIOS: programa el plan, registra un pago y revisa el estado.
const { chromium } = require('playwright');
const B = 'http://localhost:3100';
const CASO = process.env.CASO ?? '00000000-0000-0000-0000-0000000000f3';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  const errores = []; p.on('pageerror', e => errores.push(e.message));
  try {
    await p.goto(`${B}/casos/${CASO}?tab=pension`);
    console.log('fechas:', (await p.locator('dl').first().innerText()).replace(/\n/g, ' | '));
    if (!(await p.locator('#m40_desde').isVisible())) await p.getByText(/Cambiar el plan|Programar Modalidad 40/).click();
    const f = p.locator('form', { has: p.locator('#m40_desde') });
    await f.locator('#m40_desde').fill('2026-09'); await f.locator('#m40_hasta').fill('2027-02');
    await f.locator('#m40_monto').fill('4,250.50'); await f.locator('#semanas_ultimos_5_anios').fill('60');
    await f.getByRole('button', { name: 'Guardar plan' }).click(); await p.getByText(/meses pagados/).waitFor();
    console.log('plan:', await p.getByText(/meses pagados/).innerText());
    await p.getByText('Registrar pago').first().click();
    const pg = p.locator('form', { has: p.locator('#fecha_pago') }).first();
    await pg.locator('#fecha_pago').fill('2026-09-10'); await pg.getByRole('button', { name: 'Guardar' }).click();
    await p.getByText(/^1 de 6 meses pagados/).waitFor();
    console.log('estado:', await p.locator('main').getByText(/Al corriente|sin pagar|Causó baja/).first().innerText());
    console.log('aviso:', await p.getByText(/Falta el pago de|Próximo pago/).first().innerText());
    console.log('whatsapp:', await p.getByRole('link', { name: /Recordar por WhatsApp/ }).count());
    await p.screenshot({ path: process.env.CAP ?? 'm40.png', fullPage: true });
  } catch (e) { console.log('FALLÓ:', e.message.split('\n')[0]); }
  console.log('errores de página:', errores.length ? errores : 'ninguno');
  await b.close();
})();
