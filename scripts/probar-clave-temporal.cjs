// Alta con contraseña temporal y restablecimiento, con datos FICTICIOS.
// Uso: RPD_DEMO_SIN_AUTH=1 npx next dev -p 3100, y luego node scripts/probar-clave-temporal.cjs
const { chromium } = require('playwright');
const B = 'http://localhost:3100';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1600 } });
  const errores = []; p.on('pageerror', e => errores.push(e.message));
  const correo = `vendedor.${Date.now()}@ejemplo.com`;
  try {
    await p.goto(`${B}/configuracion?seccion=usuarios`, { waitUntil: 'networkidle' });
    const alta = p.locator('form').filter({ has: p.getByRole('button', { name: 'Crear cuenta' }) });
    await alta.locator('#nombre').fill('Vendedor Ficticio');
    await alta.locator('#email').fill(correo);
    console.log('rol por defecto:', await alta.locator('#rol').inputValue());
    await alta.getByRole('button', { name: 'Crear cuenta' }).click();
    const caja = alta.getByRole('status').filter({ hasText: 'Contraseña temporal' });
    await caja.waitFor();
    const clave = await caja.locator('code').innerText();
    console.log('contraseña mostrada:', /^[A-Za-z0-9]{4}(-[A-Za-z0-9]{4}){3}$/.test(clave) ? 'formato correcto' : clave);
    console.log('nota:', (await caja.innerText()).split('\n').pop());
    await p.reload({ waitUntil: 'networkidle' });
    console.log('al recargar ya no aparece:', (await p.locator('code').count()) === 0);
    const fila = p.locator('li').filter({ hasText: correo });
    console.log('en la lista:', (await fila.innerText()).split('\n').slice(0, 3).join(' | '));
    await fila.getByText('Editar').click();
    await fila.getByRole('button', { name: 'Generar contraseña temporal' }).click();
    const caja2 = fila.getByRole('status').filter({ hasText: 'Contraseña temporal' });
    await caja2.waitFor();
    const clave2 = await caja2.locator('code').innerText();
    console.log('restablecer: nueva y distinta:', clave2 !== clave);
    p.once('dialog', (d) => { console.log('confirmación:', d.message().slice(0, 60) + '…'); d.accept(); });
    await fila.getByRole('button', { name: 'Restablecer verificación en dos pasos' }).click();
    const caja3 = fila.getByRole('status').filter({ hasText: 'Verificación restablecida' });
    await caja3.waitFor();
    console.log('restablecer 2FA:', (await caja3.innerText()).split('\n')[0]);
    await p.goto(`${B}/configuracion?seccion=bitacora`, { waitUntil: 'networkidle' });
    console.log('bitácora:', [...new Set(await p.getByText(/Contraseña temporal|Restableció 2FA/).allInnerTexts())]);
    await p.goto(`${B}/configuracion?seccion=usuarios`, { waitUntil: 'networkidle' });
    const duplicado = p.locator('form').filter({ has: p.getByRole('button', { name: 'Crear cuenta' }) });
    await duplicado.locator('#nombre').fill('Otro'); await duplicado.locator('#email').fill(correo);
    await duplicado.getByRole('button', { name: 'Crear cuenta' }).click();
    console.log('correo repetido:', await duplicado.getByRole('alert').innerText());
  } catch (e) { console.log('FALLÓ:', e.message.split('\n')[0]); await p.screenshot({ path: 'fallo.png', fullPage: true }); }
  console.log('errores de página:', errores.length ? errores : 'ninguno');
  await b.close();
})();
