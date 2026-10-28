// Recorrido de dinero (fase 3): canal, pago de la Afore, cobro y comisiones.
// Uso: servidor demo en el puerto 3100 con el caso RP-0001 de prueba (ver docs).
const { chromium } = require('playwright');
const B = 'http://localhost:3100';
const CASO = process.env.CASO ?? '00000000-0000-0000-0000-0000000000d1';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  const errores = []; p.on('pageerror', e => errores.push(e.message));
  try {
    await p.goto(`${B}/casos/${CASO}?tab=dinero`);
    const canal = p.locator('form', { has: p.locator('#referidor_id') });
    await canal.locator('#referidor_id').selectOption({ label: 'Rosa Referidora' });
    await canal.getByRole('button', { name: 'Guardar' }).click();
    await canal.getByText('marca la casilla').waitFor();
    console.log('vendedor + referidor sin confirmar: bloqueado');
    await canal.locator('#confirmo_doble').check();
    await canal.getByRole('button', { name: 'Guardar' }).click(); await canal.getByText('Guardado').waitFor();
    await p.reload();
    console.log('comisiones tras canal:', await p.locator('table').last().innerText().catch(() => '(sin tabla)'));

    const pago = p.locator('form', { has: p.locator('#monto_bruto') });
    await pago.locator('#fecha_deposito').fill('2026-10-20');
    await pago.locator('#monto_bruto').fill('10000');
    await pago.getByRole('button', { name: /Registrar pago 1/ }).click(); await pago.getByText('Guardado').waitFor();
    await p.reload();
    console.log('cobro:', (await p.getByText(/Subtotal \$2,586\.21/).innerText()));
    await p.getByText('Marcar como cobrado').click();
    const cobro = p.locator('form', { has: p.locator('#fecha_cobro') });
    await cobro.locator('#fecha_cobro').fill('2026-10-22');
    await cobro.locator('#factura_folio').fill('A-123');
    await cobro.getByRole('button', { name: 'Guardar cobro' }).click(); await p.getByText('Cobrado', { exact: true }).waitFor();
    await p.reload();
    console.log('cifras:', (await p.locator('main .grid').first().innerText()).replace(/\n+/g, ' | '));
    console.log('comisiones:', (await p.locator('table').last().innerText()).replace(/\t/g, ' · '));
    await p.screenshot({ path: process.env.CAP ?? 'dinero.png', fullPage: true });
  } catch (e) { console.log('FALLÓ:', e.message.split('\n')[0]); await p.screenshot({ path: 'fallo.png', fullPage: true }); }
  console.log('errores de página:', errores.length ? errores : 'ninguno');
  await b.close();
})();
