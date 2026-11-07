// Eliminar una nota del seguimiento (se archiva), con datos FICTICIOS.
// Uso: RPD_DEMO_SIN_AUTH=1 npx next dev -p 3100, y luego CASO=<id> node scripts/probar-eliminar-nota.cjs
const { chromium } = require('playwright');
const B = 'http://localhost:3100';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1200 } });
  const errores = []; p.on('pageerror', (e) => errores.push(e.message));
  try {
    await p.goto(`${B}/casos/${process.env.CASO}?tab=seguimiento`, { waitUntil: 'networkidle' });
    const texto = `Nota de prueba ${Date.now()}`;
    await p.locator('textarea').fill(texto);
    await p.getByRole('button', { name: 'Guardar' }).click();
    await p.getByText(texto).waitFor();
    const fila = p.locator('li').filter({ hasText: texto });
    console.log('botón Eliminar en la nota:', await fila.getByRole('button', { name: 'Eliminar' }).count());
    console.log('botón Eliminar en registros del sistema:', await p.locator('li').filter({ hasText: 'Sistema ·' }).getByRole('button', { name: 'Eliminar' }).count());
    p.once('dialog', (d) => { console.log('confirmación:', d.message().split('\n')[0]); d.accept(); });
    await fila.getByRole('button', { name: 'Eliminar' }).click();
    await p.getByText(texto).waitFor({ state: 'detached', timeout: 15000 });
    console.log('después de eliminar, ¿se ve?', await p.getByText(texto).count() > 0);
  } catch (e) { console.log('FALLÓ:', e.message.split('\n')[0]); await p.screenshot({ path: 'fallo.png', fullPage: true }); }
  console.log('errores de página:', errores.length ? errores : 'ninguno');
  await b.close();
})();
