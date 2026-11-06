// Honorario pactado con datos FICTICIOS: 22% en un retiro y un pago de $10,000 → $2,200 por cobrar.
// Uso: RPD_DEMO_SIN_AUTH=1 npx next dev -p 3100, y luego node scripts/probar-honorario-pactado.cjs
const { chromium } = require('playwright');
const B = 'http://localhost:3100';
const CASO = process.env.CASO ?? '00000000-0000-0000-0000-0000000000f2';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  const errores = []; p.on('pageerror', e => errores.push(e.message));
  try {
    await p.goto(`${B}/casos/${CASO}?tab=dinero`, { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: /Registrar pago/ }).click();
    console.log('sin fecha:', await p.getByRole('alert').first().innerText());
    await p.fill('#pct_pactado', 'veinte'); await p.getByRole('button', { name: 'Guardar porcentaje' }).click();
    console.log('texto inválido:', await p.getByText('Escribe el porcentaje').first().innerText());
    await p.fill('#pct_pactado', '22'); await p.getByRole('button', { name: 'Guardar porcentaje' }).click();
    await p.getByText('Negociado con el cliente').waitFor();
    console.log('pactado:', await p.locator('h3,h2').filter({ hasText: 'Honorario pactado' }).locator('..').innerText().then(t => t.replace(/\n+/g, ' | ')).catch(() => ''));
    await p.fill('#fecha_deposito', '2026-11-03'); await p.fill('#monto_bruto', '10,000');
    await p.getByRole('button', { name: /Registrar pago/ }).click();
    await p.getByText(/Por cobrar/).first().waitFor();
    await p.waitForTimeout(1500);
    const cobros = await p.locator('section, div').filter({ hasText: /^Cobros del honorario/ }).first().innerText().catch(() => '');
    console.log('cobros:', cobros.replace(/\n+/g, ' | ').slice(0, 300));
    await p.goto(`${B}/casos/${CASO}?tab=seguimiento`, { waitUntil: 'networkidle' });
    console.log('seguimiento:', await p.getByText(/Honorario pactado con el cliente/).first().innerText());
  } catch (e) { console.log('FALLÓ:', e.message.split('\n')[0]); await p.screenshot({ path: process.env.CAP ? `${process.env.CAP}/fallo.png` : 'fallo.png', fullPage: true }); }
  console.log('errores de página:', errores.length ? errores : 'ninguno');
  await b.close();
})();
