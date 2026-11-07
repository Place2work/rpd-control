// Pago de la Afore → Pagado; honorario cobrado → cerrado; comprobante; «Clientes cerrados». Datos FICTICIOS.
// Uso: RPD_DEMO_SIN_AUTH=1 npx next dev -p 3100, y luego ARCHIVO=<png> node scripts/probar-clientes-cerrados.cjs
const { chromium } = require('playwright');
const B = 'http://localhost:3100';
const CASO = process.env.CASO ?? '00000000-0000-0000-0000-0000000000f2';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1600 } });
  const errores = []; p.on('pageerror', (e) => errores.push(e.message));
  const etapa = async () => (await p.locator('header').first().innerText()).match(/Prospecto|Pagado por Afore|Honorario cobrado/)?.[0];
  try {
    await p.goto(`${B}/casos/${CASO}?tab=dinero`, { waitUntil: 'networkidle' });
    console.log('etapa inicial:', await etapa());
    await p.fill('#fecha_deposito', '2026-11-07'); await p.fill('#monto_bruto', '35,193');
    await p.getByRole('button', { name: 'Registrar el pago de la Afore' }).click();
    await p.getByRole('note').waitFor();
    await p.reload({ waitUntil: 'networkidle' });
    console.log('tras el pago de la Afore:', await etapa());

    await p.getByText('Marcar como cobrado').click();
    await p.getByRole('button', { name: 'Guardar cobro' }).click();
    await p.getByText(/Falta el comprobante/).waitFor();
    await p.reload({ waitUntil: 'networkidle' });
    console.log('tras cobrar el honorario:', await etapa());

    const [selector] = await Promise.all([p.waitForEvent('filechooser'), p.getByRole('button', { name: 'Subir comprobante de transferencia' }).click()]);
    await selector.setFiles(process.env.ARCHIVO);
    await p.getByRole('button', { name: 'Ver comprobante' }).waitFor();
    const [ventana] = await Promise.all([p.context().waitForEvent('page'), p.getByRole('button', { name: 'Ver comprobante' }).click()]);
    await ventana.waitForLoadState();
    console.log('comprobante abre:', ventana.url().includes('/api/demo/almacen'), '· aviso de falta:', await p.getByText(/Falta el comprobante/).count());

    await p.goto(`${B}/casos/${CASO}?tab=seguimiento`, { waitUntil: 'networkidle' });
    console.log('seguimiento:', await p.getByText(/^Avanzó a/).allInnerTexts());

    await p.goto(`${B}/clientes-cerrados`, { waitUntil: 'networkidle' });
    console.log('resumen:', (await p.locator('section[aria-label=Resumen]').innerText()).replace(/\n+/g, ' | '));
    console.log('fila:', (await p.locator('tbody tr').first().innerText()).replace(/\s+/g, ' '));
    await p.goto(`${B}/prospectos`, { waitUntil: 'networkidle' });
    console.log('¿sigue en Prospectos?', await p.getByText('RP-0002').count() > 0);
    await p.goto(`${B}/casos?vista=tabla`, { waitUntil: 'networkidle' });
    console.log('casos:', await p.getByRole('group', { name: 'Mostrar' }).innerText());
    await p.goto(`${B}/hoy`, { waitUntil: 'networkidle' });
    console.log('Hoy:', (await p.getByText('Clientes cerrados del mes').locator('..').innerText()).replace(/\n+/g, ' | '));
    await p.setViewportSize({ width: 390, height: 900 });
    await p.goto(`${B}/clientes-cerrados`, { waitUntil: 'networkidle' });
    console.log('ancho celular:', await p.evaluate(() => document.documentElement.scrollWidth));
  } catch (e) { console.log('FALLÓ:', e.message.split('\n')[0]); await p.screenshot({ path: 'fallo.png', fullPage: true }); }
  console.log('errores de página:', errores.length ? errores : 'ninguno');
  await b.close();
})();
