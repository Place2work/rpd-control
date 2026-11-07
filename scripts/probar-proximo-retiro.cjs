// Pago único y leyenda del próximo retiro (5 años), con datos FICTICIOS.
// Uso: RPD_DEMO_SIN_AUTH=1 npx next dev -p 3100, y luego node scripts/probar-proximo-retiro.cjs
const { chromium } = require('playwright');
const B = 'http://localhost:3100';
const CASO = process.env.CASO ?? '00000000-0000-0000-0000-0000000000f2';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1600 } });
  const errores = []; p.on('pageerror', e => errores.push(e.message));
  try {
    await p.goto(`${B}/casos/${CASO}?tab=dinero`, { waitUntil: 'networkidle' });
    console.log('encabezado (con modalidad B elegida):', await p.getByText(/pago único|mensualidades/).first().innerText());
    await p.fill('#fecha_deposito', '2026-11-07'); await p.fill('#monto_bruto', '35,193');
    await p.getByRole('button', { name: 'Registrar el pago de la Afore' }).click();
    await p.getByRole('note').waitFor();
    console.log('leyenda en Dinero:', (await p.getByRole('note').innerText()).replace(/\n/g, ' | '));
    console.log('¿sigue el formulario?', await p.locator('#monto_bruto').count() > 0);
    await p.goto(`${B}/casos/${CASO}?tab=resumen`, { waitUntil: 'networkidle' });
    console.log('leyenda en Resumen:', (await p.getByRole('note').innerText()).split('\n')[0]);
    await p.goto(`${B}/casos/${CASO}?tab=seguimiento`, { waitUntil: 'networkidle' });
    console.log('seguimiento:', await p.getByText(/Próximo retiro por desempleo del cliente/).first().innerText());
  } catch (e) { console.log('FALLÓ:', e.message.split('\n')[0]); await p.screenshot({ path: 'fallo.png', fullPage: true }); }
  console.log('errores de página:', errores.length ? errores : 'ninguno');
  await b.close();
})();
