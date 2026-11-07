// Asignar el asesor que lleva el trámite, con datos FICTICIOS.
// Uso: RPD_DEMO_SIN_AUTH=1 npx next dev -p 3100, y luego node scripts/probar-asignar-asesor.cjs
const { chromium } = require('playwright');
const B = 'http://localhost:3100';
const CASO = process.env.CASO ?? '00000000-0000-0000-0000-0000000000f3';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  const errores = []; p.on('pageerror', e => errores.push(e.message));
  try {
    await p.goto(`${B}/casos/${CASO}?tab=resumen`, { waitUntil: 'networkidle' });
    const opciones = await p.locator('#asignado_a option').allInnerTexts();
    console.log('opciones:', opciones);
    await p.selectOption('#asignado_a', { label: opciones.find((o) => o.includes('Asesor Prueba')) });
    await p.getByRole('button', { name: 'Guardar asesor' }).click();
    await p.getByText(/Asignado a /).waitFor();
    console.log('encabezado:', await p.getByText(/Asignado a /).first().innerText());
    await p.goto(`${B}/casos?vista=tabla&embudo=pension`, { waitUntil: 'networkidle' });
    console.log('tabla:', await p.locator('tbody tr').first().innerText().then((t) => t.replace(/\s+/g, ' ')));
    await p.goto(`${B}/casos/${CASO}?tab=resumen`, { waitUntil: 'networkidle' });
    await p.selectOption('#asignado_a', '');
    await p.getByRole('button', { name: 'Guardar asesor' }).click();
    await p.getByText('Bandeja general').first().waitFor();
    await p.goto(`${B}/casos/${CASO}?tab=seguimiento`, { waitUntil: 'networkidle' });
    console.log('seguimiento:', await p.getByText(/bandeja general|asignado a/i).allInnerTexts());
  } catch (e) { console.log('FALLÓ:', e.message.split('\n')[0]); }
  console.log('errores de página:', errores.length ? errores : 'ninguno');
  await b.close();
})();
