// Comisiones (fase 3): resumen del mes, liquidar, estado de cuenta PDF y alta de referidor.
// Uso: después de scripts/probar-flujo-dinero.cjs, con el servidor demo en el puerto 3100.
const { chromium } = require('playwright');
const B = 'http://localhost:3100';
const MES = process.env.MES ?? '2026-10';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1300 } });
  const errores = []; p.on('pageerror', e => errores.push(e.message));
  try {
    await p.goto(`${B}/comisiones?mes=${MES}`);
    console.log('resumen:', (await p.locator('table').first().innerText()).replace(/\t/g, ' · ').replace(/\n/g, ' | '));
    await p.getByRole('link', { name: 'Juan Carvajal' }).click(); await p.getByText('Marcar como pagada').waitFor();
    const pdfUrl = await p.getByRole('link', { name: /Estado de cuenta PDF/ }).getAttribute('href');
    const f = p.locator('form', { has: p.locator('#fecha_pago') });
    await f.locator('#fecha_pago').fill('2026-10-27'); await f.locator('#referencia').fill('SPEI 991');
    await f.getByRole('button', { name: 'Registrar pago' }).click();
    await p.getByText(/Pagos del mes:/).waitFor();
    console.log('tras liquidar:', await p.getByText(/Pagos del mes:/).innerText());
    const r = await p.request.get(B + pdfUrl); console.log('pdf', r.status(), r.headers()['content-type']);
    require('fs').writeFileSync(process.env.PDF ?? 'estado.pdf', await r.body());
    await p.goto(`${B}/comisiones/beneficiarios`);
    await p.getByText('Nuevo referidor').click();
    const nr = p.locator('form', { has: p.locator('#clabe') }).first();
    await nr.locator('#nombre').fill('Pedro Referidor'); await nr.locator('#clabe').fill('002010077777777772');
    await nr.getByRole('button', { name: 'Dar de alta' }).click(); await nr.getByText('no es válida').waitFor();
    console.log('CLABE mala: rechazada');
    await nr.locator('#clabe').fill('002010077777777771');
    await nr.getByRole('button', { name: 'Dar de alta' }).click(); await nr.getByText('Guardado').waitFor();
    console.log('referidor:', await p.getByText('Pedro Referidor').locator('..').innerText());
  } catch (e) { console.log('FALLÓ:', e.message.split('\n')[0]); await p.screenshot({ path: 'fallo.png', fullPage: true }); }
  console.log('errores de página:', errores.length ? errores : 'ninguno');
  await b.close();
})();
