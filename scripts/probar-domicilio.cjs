// Domicilio por partes con catálogo del INEGI, con datos FICTICIOS.
// Uso: RPD_DEMO_SIN_AUTH=1 npx next dev -p 3100, y luego CASO=<id> node scripts/probar-domicilio.cjs
const { chromium } = require('playwright');
const B = 'http://localhost:3100';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1700 } });
  const errores = []; p.on('pageerror', (e) => errores.push(e.message));
  try {
    await p.goto(`${B}/casos/${process.env.CASO}?tab=datos`, { waitUntil: 'networkidle' });
    await p.locator('#estado option').nth(5).waitFor({ state: 'attached' });
    console.log('estado previo empatado:', await p.inputValue('#estado'), '· municipio previo:', await p.inputValue('#municipio'));
    console.log('estados en lista:', (await p.locator('#estado option').count()) - 1, '· municipios de Querétaro:', (await p.locator('#municipio option').count()) - 2);
    await p.fill('#calle', 'Santa Elena'); await p.fill('#numero_exterior', '202'); await p.fill('#numero_interior', '402 C');
    await p.fill('#colonia', 'Marbella'); await p.fill('#codigo_postal', '76226');
    await p.selectOption('#municipio', 'Querétaro');
    console.log('vista previa:', await p.getByText('Así va en el contrato').locator('..').locator('p').nth(1).innerText());
    await p.fill('#codigo_postal', '62440');
    console.log('sugerencia por CP:', await p.getByRole('button', { name: /Usar este estado/ }).innerText());
    await p.fill('#codigo_postal', '76226');
    await p.getByRole('button', { name: 'Guardar' }).first().click();
    await p.getByText('Guardado').first().waitFor();
    await p.goto(`${B}/casos/${process.env.CASO}?tab=contrato`, { waitUntil: 'networkidle' });
    console.log('en Contrato:', await p.locator('#domicilio').first().inputValue());
  } catch (e) { console.log('FALLÓ:', e.message.split('\n')[0]); await p.screenshot({ path: 'fallo.png', fullPage: true }); }
  console.log('errores de página:', errores.length ? errores : 'ninguno');
  await b.close();
})();
