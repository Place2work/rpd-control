// Costo administrativo propio de un alta (pensión en $0 y luego $800). Datos FICTICIOS.
// Uso: RPD_DEMO_SIN_AUTH=1 npx next dev -p 3100, y luego node scripts/probar-costo-alta.cjs
const { chromium } = require('playwright');
const B = 'http://localhost:3100';
const tarjeta = async (p) => (await p.locator('main').getByText('Costo administrativo', { exact: true }).locator('xpath=ancestor::*[contains(@class,"rounded")][1]').innerText()).replace(/\s+/g, ' ');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  const errores = []; p.on('pageerror', (e) => errores.push(e.message));
  try {
    await p.goto(`${B}/prospectos`, { waitUntil: 'networkidle' });
    console.log('antes:', await tarjeta(p));
    await p.goto(`${B}/prospectos/nuevo`, { waitUntil: 'networkidle' });
    await p.fill('#nombre', 'Cliente Pension'); await p.fill('#apellido_paterno', 'Costo'); await p.fill('#whatsapp', `57${String(Date.now()).slice(-8)}`);
    await p.uncheck('input[value=RETIRO_DESEMPLEO]'); await p.check('input[value=PENSION_L73]');
    await p.fill('#costo_admin_alta', '-3'); await p.locator('form button[type=submit]').last().click();
    await p.getByText('Escribe el monto en pesos').waitFor(); console.log('negativo: muestra «Escribe el monto en pesos…»');
    await p.fill('#costo_admin_alta', '0'); await p.locator('form button[type=submit]').last().click();
    await p.waitForURL(/\/casos\/[0-9a-f-]{36}/, { timeout: 20000 });
    const caso = p.url().split('?')[0];
    await p.goto(`${B}/prospectos`, { waitUntil: 'networkidle' });
    console.log('con pensión en $0:', await tarjeta(p));
    await p.goto(`${caso}?tab=dinero`, { waitUntil: 'networkidle' });
    const card = p.locator('main').getByText('Costo administrativo del alta').locator('xpath=ancestor::*[contains(@class,"rounded")][1]');
    console.log('pestaña dinero:', (await card.innerText()).replace(/\s+/g, ' ').slice(0, 200));
    await p.fill('#costo_admin_alta', '800'); await card.getByRole('button', { name: 'Guardar costo' }).click();
    await p.waitForTimeout(2500); await p.reload({ waitUntil: 'networkidle' });
    console.log('después de $800:', (await card.innerText()).replace(/\s+/g, ' ').slice(0, 120));
    await p.screenshot({ path: 'costo-dinero.png', fullPage: false });
    await p.goto(`${B}/prospectos`, { waitUntil: 'networkidle' });
    console.log('con pensión en $800:', await tarjeta(p));
  } catch (e) { console.log('FALLÓ:', e.message.split('\n')[0]); await p.screenshot({ path: 'fallo.png', fullPage: true }); }
  console.log('errores de página:', errores.length ? errores : 'ninguno');
  await b.close();
})();
