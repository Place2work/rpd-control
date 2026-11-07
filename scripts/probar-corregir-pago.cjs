// Corregir un pago de la Afore mal fechado: regresar a pago esperado y bloqueo de fechas absurdas. Datos FICTICIOS.
// Requiere un pago registrado en el caso (se corrige una vez). Uso: RPD_DEMO_SIN_AUTH=1 npx next dev -p 3100, y luego CASO=<id> node scripts/probar-corregir-pago.cjs
const { chromium } = require('playwright');
const B = 'http://localhost:3100';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1800 } });
  const errores = []; p.on('pageerror', (e) => errores.push(e.message));
  const etapa = async () => (await p.locator('header').first().innerText()).match(/Prospecto|Pagado por Afore/)?.[0];
  try {
    await p.goto(`${B}/casos/${process.env.CASO}?tab=dinero`, { waitUntil: 'networkidle' });
    console.log('antes:', await etapa());
    await p.getByText('Corregir').first().click();
    p.once('dialog', (d) => d.accept());
    await p.getByRole('button', { name: 'Regresar a pago esperado' }).click();
    await p.getByRole('heading', { name: 'Pago esperado de la Afore' }).waitFor({ timeout: 20000 });
    console.log('después:', await etapa(), '· monto esperado:', await p.inputValue('#monto_esperado'));
    console.log('proyección:', await p.getByText(/honorario proyectado/).first().innerText());
    await p.fill('#fecha_deposito', '0001-01-01'); await p.fill('#monto_bruto', '35193');
    // El navegador la bloquea (mínimo 2000-01-01) y el servidor también la rechazaría.
    console.log('fecha 0001 bloqueada en el navegador:', await p.locator('#fecha_deposito').evaluate((el) => !el.checkValidity()));
  } catch (e) { console.log('FALLÓ:', e.message.split('\n')[0]); await p.screenshot({ path: 'fallo.png', fullPage: true }); }
  console.log('errores de página:', errores.length ? errores : 'ninguno');
  await b.close();
})();
