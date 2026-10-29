// Bloque 1 con datos FICTICIOS: tablero con arrastre, tabla, filtros de prospectos, Hoy y desvío.
// Uso: RPD_DEMO_SIN_AUTH=1 npx next dev -p 3100, y luego node scripts/probar-bloque1.cjs
const { chromium } = require('playwright');
const B = 'http://localhost:3100';
const CASO = process.env.CASO ?? '00000000-0000-0000-0000-0000000000f2';
const CAP = process.env.CAP ?? '.';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
  const errores = []; p.on('pageerror', e => errores.push(e.message));
  try {
    await p.goto(`${B}/casos`, { waitUntil: 'networkidle' });
    const tarjeta = p.locator('li[draggable]').filter({ hasText: 'RP-0002' });
    await tarjeta.dragTo(p.locator('section[aria-label="Contrato firmado"]'));
    await p.getByRole('dialog').waitFor();
    console.log('arrastrar a Contrato:', (await p.getByRole('dialog').innerText()).replace(/\n+/g, ' | '));
    await p.screenshot({ path: `${CAP}/tablero-faltantes.png` });
    await p.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click();
    await tarjeta.dragTo(p.locator('section[aria-label="Precalificado"]'));
    await p.getByRole('status').filter({ hasText: 'pasó a' }).waitFor();
    await p.locator('section[aria-label="Precalificado"] li[draggable]').first().waitFor();
    console.log('arrastrar a Precalificado:', await p.getByRole('status').filter({ hasText: 'pasó a' }).innerText(),
      '· ahora en la columna:', await p.locator('section[aria-label="Precalificado"] li[draggable]').count());

    // Regresar de etapa pide motivo (6.1).
    await p.locator('li[draggable]').filter({ hasText: 'RP-0002' }).dragTo(p.locator('section[aria-label="Prospecto"]'));
    await p.locator('#motivo-mover').fill('Fal');
    console.log('motivo corto, botón Mover deshabilitado:', await p.getByRole('button', { name: 'Mover' }).isDisabled());
    await p.locator('#motivo-mover').fill('Hay que revisar las semanas');
    await p.getByRole('button', { name: 'Mover' }).click();
    await p.getByRole('status').filter({ hasText: '«Prospecto»' }).waitFor();
    console.log('con motivo:', await p.getByRole('status').filter({ hasText: 'pasó a' }).innerText());
    await p.locator('section[aria-label="Prospecto"] li[draggable]').first().waitFor();
    await p.locator('li[draggable]').filter({ hasText: 'RP-0002' }).dragTo(p.locator('section[aria-label="Precalificado"]'));
    await p.getByRole('status').filter({ hasText: '«Precalificado»' }).waitFor();

    await p.goto(`${B}/casos?vista=tablero&embudo=pension`, { waitUntil: 'networkidle' });
    console.log('pensión, columnas:', await p.locator('section[role=listitem]').count(), '· tarjetas:', await p.locator('li[draggable]').count());

    await p.goto(`${B}/casos?vista=tabla&embudo=retiro`, { waitUntil: 'networkidle' });
    console.log('tabla:', await p.locator('tbody tr').count(), 'filas ·', await p.getByText(/de \d+ caso/).innerText());
    await p.fill('#t-q', 'zzz'); console.log('búsqueda sin coincidencia:', await p.locator('tbody tr').innerText());

    await p.goto(`${B}/prospectos?origen=facebook`, { waitUntil: 'networkidle' });
    console.log('filtro origen=facebook:', await p.getByText(/resultado/).first().innerText());
    await p.goto(`${B}/prospectos?sin_contacto=3&regimen=L97`, { waitUntil: 'networkidle' });
    console.log('filtro sin contacto + régimen:', await p.getByText(/resultado/).first().innerText());

    await p.goto(`${B}/hoy`, { waitUntil: 'networkidle' });
    const ind = await p.locator('section[aria-label=Indicadores]').innerText();
    console.log('Hoy:', ind.replace(/\n+/g, ' | '));
    await p.screenshot({ path: `${CAP}/hoy.png`, fullPage: true });

    await p.goto(`${B}/casos/${CASO}?tab=calculo`, { waitUntil: 'networkidle' });
    console.log('servicio sugerido:', await p.locator('#desvio-servicio').inputValue());
    await p.getByRole('button', { name: 'Crear caso del servicio' }).click();
    await p.waitForURL((u) => /\/casos\/[0-9a-f-]{36}$/.test(u.pathname) && !u.pathname.endsWith(CASO), { timeout: 20000 });
    console.log('caso nuevo:', (await p.locator('main h1').first().innerText()), '·', p.url().split('/casos/')[1]);
    await p.goto(`${B}/casos/${CASO}?tab=calculo`, { waitUntil: 'networkidle' });
    console.log('en el original:', await p.getByText(/^Desvío:/).innerText());
    await p.goto(`${B}/casos?vista=tablero&embudo=retiro`, { waitUntil: 'networkidle' });
    console.log('original en Perdido:', await p.locator('section[aria-label="Perdido o desvío"] li').count());
    await p.setViewportSize({ width: 390, height: 900 });
    await p.goto(`${B}/prospectos`, { waitUntil: 'networkidle' });
    console.log('ancho celular prospectos:', await p.evaluate(() => document.documentElement.scrollWidth));
  } catch (e) { console.log('FALLÓ:', e.message.split('\n')[0]); await p.screenshot({ path: `${CAP}/fallo.png`, fullPage: true }); }
  console.log('errores de página:', errores.length ? errores : 'ninguno');
  await b.close();
})();
