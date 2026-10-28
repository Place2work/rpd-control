// Recorrido de documentos: subir, rechazar, versión nueva, validar, expediente completo e ingreso.
// Uso: igual que probar-flujo-alta.cjs.
const { chromium } = require('playwright');
const B = 'http://localhost:3100';
const foto = (n) => ({ name: `doc${n}.jpg`, mimeType: 'image/jpeg', buffer: Buffer.alloc(300 * 1024, n) });
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errores = []; p.on('pageerror', e => errores.push(e.message));
  await p.goto(B + '/prospectos/nuevo');
  await p.fill('#nombre', 'Rosa'); await p.fill('#whatsapp', '777 555 0002'); await p.fill('#fecha_baja', '2026-08-01');
  await p.getByRole('button', { name: 'Dar de alta' }).click();
  await p.waitForURL(/\/casos\//); const caso = p.url().split('?')[0];
  // Dejarlo en expediente directo por SQL no: usamos la app (dictamen → precalificado → contrato).
  await p.goto(caso + '?tab=imss'); await p.locator('#estado_ultimo_retiro').waitFor();
  await p.selectOption('#estado_ultimo_retiro', 'nunca_retiro');
  await p.locator('main form').nth(1).getByRole('button', { name: 'Guardar' }).click(); await p.locator('main form').nth(1).getByText('Guardado').waitFor();
  await p.selectOption('#dictamen_manual', 'APTO'); await p.fill('#dictamen_manual_motivo', 'Revisado con estado de cuenta, apto');
  await p.getByRole('button', { name: 'Guardar dictamen' }).click(); await p.locator('main form').nth(2).getByText('Guardado').waitFor();
  for (const [op, btn] of [[/^Precalificado/, 'Pasar a «Precalificado»'], [/^Contrato firmado/, 'Pasar a «Contrato firmado»']]) {
    await p.goto(caso + '?tab=resumen'); await p.locator('text=Siguiente paso').waitFor();
    await p.getByRole('button', { name: op }).click(); await p.getByRole('button', { name: btn }).click(); await p.waitForTimeout(1200);
  }
  await p.goto(caso + '?tab=documentos'); await p.locator('text=obligatorios validados').first().waitFor();
  console.log('inicio:', await p.locator('text=obligatorios validados').first().innerText());
  const filas = p.locator('main ul.divide-y > li');
  console.log('documentos en la lista:', await filas.count());
  // Foto muy ligera
  await filas.nth(0).locator('input[type=file]').setInputFiles({ name: 'chica.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(50 * 1024) });
  console.log('foto chica →', await filas.nth(0).getByRole('alert').innerText());
  // Comprobante de domicilio sin fecha de emisión
  const dom = filas.filter({ hasText: 'Comprobante de domicilio' });
  await dom.locator('input[type=file]').setInputFiles(foto(9));
  console.log('domicilio sin emisión →', await dom.getByRole('alert').innerText());
  await dom.locator('input[type=date]').fill('2026-10-10');
  await dom.locator('input[type=file]').setInputFiles(foto(9));
  await dom.getByText('Por revisar').waitFor();
  console.log('domicilio vence:', await dom.locator('text=Vence').innerText());
  // Subir el resto
  const n = await filas.count();
  for (let i = 0; i < n; i++) {
    const f = filas.nth(i);
    if (await f.getByText('Por revisar').count()) continue;
    await f.locator('input[type=file]').setInputFiles(foto(i + 1));
    await f.getByText('Por revisar').waitFor();
  }
  // Rechazar el primero y volverlo a subir
  await filas.nth(0).getByRole('button', { name: 'Rechazar' }).click();
  await filas.nth(0).getByLabel('Motivo del rechazo').fill('Foto borrosa, no se lee el folio');
  await filas.nth(0).getByRole('button', { name: 'Rechazar' }).nth(1).click();
  await filas.nth(0).getByText('Motivo: Foto borrosa').waitFor();
  console.log('rechazo con motivo: sí');
  await filas.nth(0).locator('input[type=file]').setInputFiles(foto(20));
  await filas.nth(0).getByText('Por revisar').waitFor();
  console.log('versiones del primero:', await filas.nth(0).locator('text=versiones').innerText());
  // Ver uno (bitácora) y validar todos
  const [popup] = await Promise.all([p.waitForEvent('popup'), filas.nth(1).getByRole('button', { name: 'Ver' }).click()]);
  console.log('ver abre archivo:', (await popup.evaluate(() => document.contentType)));
  await popup.close();
  for (let i = 0; i < n; i++) {
    const f = filas.nth(i);
    if (await f.getByRole('button', { name: 'Validar' }).count()) { await f.getByRole('button', { name: 'Validar' }).click(); await f.getByText('Validado').waitFor(); }
  }
  await p.reload(); await p.locator('text=obligatorios validados').first().waitFor();
  console.log('final:', await p.locator('text=obligatorios validados').first().innerText());
  console.log('mensaje:', await p.locator('text=Completo desde').innerText());
  await p.screenshot({ path: '/tmp/rpd-cap-10-documentos.png', fullPage: true });
  // Ingresar a la Afore
  await p.goto(caso + '?tab=resumen'); await p.locator('text=Siguiente paso').waitFor();
  await p.getByRole('button', { name: /^Ingresada a Afore/ }).click();
  await p.fill('#acuse_afore', 'XXI-2026-000123');
  await p.getByRole('button', { name: 'Pasar a «Ingresada a Afore»' }).click(); await p.waitForTimeout(1500); await p.reload();
  await p.locator('main h1').waitFor();
  console.log('etapa:', await p.locator('header span[class*=rounded-full]').first().innerText(),
    '· límite Afore:', await p.locator('dt:has-text("Límite de resolución") + dd').innerText());
  console.log('errores de página:', errores.length ? errores : 'ninguno');
  await b.close();
})().catch(e => { console.error('FALLÓ:', e.message.split('\n')[0]); process.exit(1); });
