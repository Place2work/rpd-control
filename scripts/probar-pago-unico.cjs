// Un retiro se paga una vez (modalidad A); la B admite mensualidades. Datos FICTICIOS.
// Uso: RPD_DEMO_SIN_AUTH=1 npx next dev -p 3100, y luego node scripts/probar-pago-unico.cjs
const { chromium } = require('playwright');
const B = 'http://localhost:3100';
const CASO = process.env.CASO ?? '00000000-0000-0000-0000-0000000000f2';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1600 } });
  const errores = []; p.on('pageerror', e => errores.push(e.message));
  try {
    await p.goto(`${B}/casos/${CASO}?tab=dinero`, { waitUntil: 'networkidle' });
    console.log('encabezado:', await p.getByText(/pago único|mensualidades/).first().innerText());
    await p.fill('#fecha_deposito', '2026-11-05'); await p.fill('#monto_bruto', '35,193');
    await p.getByRole('button', { name: 'Registrar el pago de la Afore' }).click();
    await p.getByText(/se paga una sola vez/).waitFor();
    console.log('después del pago:', await p.getByText(/se paga una sola vez/).innerText());
    console.log('¿sigue el formulario?', await p.locator('#monto_bruto').count() > 0);
    if (process.env.MODALIDAD_B) {
      await p.reload({ waitUntil: 'networkidle' });
      console.log('con modalidad B:', await p.getByText(/mensualidades/).first().innerText());
      await p.fill('#fecha_deposito', '2026-11-05'); await p.fill('#monto_bruto', '35193');
      p.once('dialog', (d) => { console.log('confirmación:', d.message()); d.accept(); });
      await p.getByRole('button', { name: /Registrar mensualidad 2/ }).click();
      console.log('duplicado:', await p.getByRole('alert').first().innerText());
    }
  } catch (e) { console.log('FALLÓ:', e.message.split('\n')[0]); await p.screenshot({ path: 'fallo.png', fullPage: true }); }
  console.log('errores de página:', errores.length ? errores : 'ninguno');
  await b.close();
})();
