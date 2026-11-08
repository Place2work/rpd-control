// % de comisión propio por vendedor y alta de referidor sin duplicar, con datos FICTICIOS.
// Uso: RPD_DEMO_SIN_AUTH=1 npx next dev -p 3100, y luego CASO=<id con vendedor> CORREO=<correo del vendedor> node scripts/probar-comision-vendedor.cjs
const { chromium } = require('playwright');
const B = 'http://localhost:3100';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1800 } });
  const errores = []; p.on('pageerror', (e) => errores.push(e.message));
  const comision = async () => {
    await p.goto(`${B}/casos/${process.env.CASO}?tab=dinero`, { waitUntil: 'networkidle' });
    return (await p.locator('li, tr').filter({ hasText: /Vendedor/ }).filter({ hasText: /\$/ }).first().innerText().catch(() => '')).replace(/\s+/g, ' ');
  };
  try {
    await p.goto(`${B}/casos/${process.env.CASO}?tab=dinero`, { waitUntil: 'networkidle' });
    if (await p.getByRole('button', { name: 'Registrar el pago de la Afore' }).count()) {
      await p.fill('#fecha_deposito', '2026-11-05'); await p.fill('#monto_bruto', '35193');
      await p.getByRole('button', { name: 'Registrar el pago de la Afore' }).click();
      await p.getByRole('note').waitFor();
    }
    console.log('comisión con el general:', await comision());
    await p.goto(`${B}/configuracion?seccion=usuarios`, { waitUntil: 'networkidle' });
    const fila = p.locator('li').filter({ hasText: process.env.CORREO }).first();
    await fila.getByText('Editar').click();
    console.log('opciones de %:', await fila.locator('#comision_pct option').count());
    await fila.locator('#comision_pct').selectOption('0.07');
    await fila.getByRole('button', { name: 'Guardar' }).first().click();
    await fila.getByText('Guardado').waitFor();
    await p.reload({ waitUntil: 'networkidle' });
    console.log('en la lista:', (await p.locator('li').filter({ hasText: process.env.CORREO }).first().locator('p').nth(1).innerText()));
    console.log('comisión con 7%:', await comision());
    await p.goto(`${B}/comisiones/beneficiarios`, { waitUntil: 'networkidle' });
    const nombre = `Referidor Ficticio ${Date.now() % 10000}`;
    await p.getByText('Nuevo referidor').click();
    const forma = p.locator('form').filter({ has: p.getByRole('button', { name: 'Dar de alta' }) }).first();
    await forma.locator('#nombre').fill(nombre);
    await forma.getByRole('button', { name: 'Dar de alta' }).click();
    await p.getByText(nombre).first().waitFor();
    console.log('formulario limpio:', (await forma.locator('#nombre').inputValue()) === '');
    await forma.locator('#nombre').fill(nombre);
    await forma.getByRole('button', { name: 'Dar de alta' }).click();
    console.log('repetido:', await forma.getByRole('alert').innerText());
    console.log('liga a vendedores:', await p.getByRole('link', { name: /Agregar vendedores/ }).count());
  } catch (e) { console.log('FALLÓ:', e.message.split('\n')[0]); await p.screenshot({ path: 'fallo.png', fullPage: true }); }
  console.log('errores de página:', errores.length ? errores : 'ninguno');
  await b.close();
})();
