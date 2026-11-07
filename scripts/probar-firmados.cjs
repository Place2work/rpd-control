// Subir el contrato y el aviso firmados desde la pestaña Contrato, con datos FICTICIOS.
// Uso: RPD_DEMO_SIN_AUTH=1 npx next dev -p 3100, y luego ARCHIVO=<pdf> node scripts/probar-firmados.cjs
const { chromium } = require('playwright');
const B = 'http://localhost:3100';
const CASO = process.env.CASO ?? '00000000-0000-0000-0000-0000000000f2';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1600 } });
  const errores = []; p.on('pageerror', (e) => errores.push(e.message));
  try {
    await p.goto(`${B}/casos/${CASO}?tab=contrato`, { waitUntil: 'networkidle' });
    for (const texto of ['Subir contrato firmado', 'Subir aviso firmado']) {
      const [sel] = await Promise.all([p.waitForEvent('filechooser'), p.getByRole('button', { name: texto }).click()]);
      await sel.setFiles(process.env.ARCHIVO);
      await p.waitForLoadState('networkidle');
    }
    await p.getByText(/Firmado · subido el/).nth(1).waitFor();
    console.log('estado:', await p.getByText(/Firmado · subido el/).allInnerTexts());
    // El PDF se descarga en el navegador sin pantalla: se comprueba la respuesta del almacén.
    const [resp] = await Promise.all([p.context().waitForEvent('response', (r) => r.url().includes('/api/demo/almacen')), p.getByRole('button', { name: 'Ver' }).first().click()]);
    console.log('abre:', resp.status(), resp.headers()['content-type']);
    await p.goto(`${B}/casos/${CASO}?tab=documentos`, { waitUntil: 'networkidle' });
    console.log('en Documentos:', await p.getByText(/Contrato firmado|Aviso de privacidad firmado/).count() >= 2);
  } catch (e) { console.log('FALLÓ:', e.message.split('\n')[0]); await p.screenshot({ path: 'fallo.png', fullPage: true }); }
  console.log('errores de página:', errores.length ? errores : 'ninguno');
  await b.close();
})();
