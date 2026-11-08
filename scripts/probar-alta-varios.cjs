// Alta con varios servicios: un caso por servicio para la misma persona. Datos FICTICIOS.
// Uso: RPD_DEMO_SIN_AUTH=1 npx next dev -p 3100, y luego node scripts/probar-alta-varios.cjs
const { chromium } = require('playwright');
const B = 'http://localhost:3100';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  const errores = []; p.on('pageerror', (e) => errores.push(e.message));
  try {
    await p.goto(`${B}/prospectos/nuevo`, { waitUntil: 'networkidle' });
    console.log('servicios:', await p.locator('input[name=tipo_servicio]').count(), '· marcado de entrada:', await p.locator('input[name=tipo_servicio]:checked').getAttribute('value'));
    console.log('nombres:', (await p.locator('fieldset label').allInnerTexts()).filter((t) => /Ley 73|Infonavit/.test(t)));
    const tel = `55${String(Date.now()).slice(-8)}`;
    await p.fill('#nombre', 'Cliente Varios'); await p.fill('#apellido_paterno', 'Servicios'); await p.fill('#whatsapp', tel);
    await p.check('input[value=PENSION_L73]'); await p.check('input[value=CORRECCION_NSS]');
    await p.locator('form button[type=submit]').last().click();
    await p.waitForURL(/\/casos\/[0-9a-f-]{36}/, { timeout: 20000 });
    await p.goto(`${B}/prospectos?q=Cliente%20Varios`, { waitUntil: 'networkidle' });
    console.log('casos creados:', (await p.locator('main ul li').filter({ hasText: 'Cliente Varios' }).allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').match(/RP-\d+ · ([^·]+)/)?.[1]?.trim()));
    await p.locator('main ul li').filter({ hasText: 'Cliente Varios' }).first().locator('a').first().click();
    await p.waitForURL(/\/casos\//);
    await p.goto(p.url().split('?')[0] + '?tab=seguimiento', { waitUntil: 'networkidle' });
    console.log('seguimiento:', await p.getByText(/Alta de prospecto/).first().innerText());
    await p.goto(`${B}/prospectos/nuevo`, { waitUntil: 'networkidle' });
    await p.uncheck('input[value=RETIRO_DESEMPLEO]'); await p.fill('#nombre', 'Sin Servicio'); await p.fill('#whatsapp', `56${String(Date.now()).slice(-8)}`);
    await p.locator('form button[type=submit]').last().click();
    await p.getByText('Elige al menos un servicio').waitFor();
    console.log('sin servicio:', 'Elige al menos un servicio');
  } catch (e) { console.log('FALLÓ:', e.message.split('\n')[0]); await p.screenshot({ path: 'fallo.png', fullPage: true }); }
  console.log('errores de página:', errores.length ? errores : 'ninguno');
  await b.close();
})();
