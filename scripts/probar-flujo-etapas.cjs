// Recorrido de la fase 1, parte 2: IMSS y Afore, dictamen y cambios de etapa.
// Uso: igual que probar-flujo-alta.cjs (servidor en modo demostración en el puerto 3100).
const { chromium } = require('playwright');
const B = 'http://localhost:3100';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errores = []; p.on('pageerror', e => errores.push(e.message));
  // Alta mínima
  await p.goto(B + '/prospectos/nuevo');
  await p.fill('#nombre', 'Mario'); await p.fill('#whatsapp', '777 555 0001');
  await p.getByRole('button', { name: 'Dar de alta' }).click();
  await p.waitForURL(/\/casos\//); const caso = p.url().split('?')[0];
  await p.locator('text=Siguiente paso').waitFor();
  // Resumen: sin dictamen no puede precalificar
  console.log('sin dictamen:', await p.locator('text=Registra el dictamen «Apto» en IMSS y Afore').count() > 0);
  // IMSS y Afore
  await p.goto(caso + '?tab=imss');
  await p.locator('#fecha_baja').waitFor();
  await p.fill('#fecha_baja', '2026-08-01'); await p.fill('#fecha_primera_alta', '2005-03-01');
  await p.fill('#semanas_cotizadas', '950'); await p.fill('#semanas_descontadas', '10'); await p.fill('#sbc_ultimo', '450.50');
  await p.locator('main form').nth(0).getByRole('button', { name: 'Guardar' }).click();
  await p.locator('main form').nth(0).getByText('Guardado').waitFor();
  await p.reload(); await p.locator('main h1').waitFor(); await p.waitForTimeout(400);
  console.log('semanas totales calculadas:', (await p.locator('text=940').count()) > 0, '· régimen:', await p.inputValue('#regimen'));
  await p.selectOption('#estado_ultimo_retiro', 'con_retiro');
  await p.locator('main form').nth(1).getByRole('button', { name: 'Guardar' }).click();
  await p.locator('main form').nth(1).getByRole('alert').waitFor();
  console.log('con retiro sin fecha →', await p.locator('main form').nth(1).getByRole('alert').innerText());
  await p.selectOption('#estado_ultimo_retiro', 'nunca_retiro'); await p.fill('#banco', 'Nu México'); await p.fill('#clabe', '012180001234567891');
  await p.locator('main form').nth(1).getByRole('button', { name: 'Guardar' }).click();
  await p.locator('main form').nth(1).getByText('Guardado').waitFor();
  await p.reload(); await p.locator('main h1').waitFor(); await p.waitForTimeout(400);
  console.log('aviso cuenta digital:', (await p.locator('text=suele ser cuenta solo digital').count()) > 0, '· CLABE enmascarada:', (await p.locator('text=•••• 7891').count()) > 0);
  await p.selectOption('#dictamen_manual', 'APTO'); await p.fill('#dictamen_manual_motivo', 'corto');
  await p.getByRole('button', { name: 'Guardar dictamen' }).click();
  await p.locator('text=Explica el motivo').waitFor();
  console.log('dictamen motivo corto rechazado: sí');
  await p.fill('#dictamen_manual_motivo', 'Cuenta con 2 años 10 meses; confirmado con la Afore por teléfono');
  await p.getByRole('button', { name: 'Guardar dictamen' }).click();
  await p.locator('main form').nth(2).getByText('Guardado').waitFor();
  // Precalificado
  await p.goto(caso + '?tab=resumen');
  await p.getByRole('button', { name: /^Precalificado/ }).click();
  await p.getByRole('button', { name: 'Pasar a «Precalificado»' }).click();
  await p.locator('text=Siguiente paso').waitFor(); await p.waitForTimeout(800); await p.reload(); await p.locator('main h1').waitFor(); await p.waitForTimeout(400);
  console.log('etapa:', await p.locator('header span[class*=rounded-full]').first().innerText());
  // Contrato → Expediente automático
  await p.getByRole('button', { name: /^Contrato firmado/ }).click();
  await p.getByRole('button', { name: 'Pasar a «Contrato firmado»' }).click();
  await p.waitForTimeout(1500); await p.reload(); await p.locator('main h1').waitFor(); await p.waitForTimeout(400);
  console.log('tras firmar, etapa:', await p.locator('header span[class*=rounded-full]').first().innerText(), '· vence:', await p.locator('dt:has-text("Vence el contrato") + dd').innerText());
  // Ingresar sin documentos
  await p.getByRole('button', { name: /^Ingresada a Afore/ }).click();
  await p.fill('#acuse_afore', 'XXI-123');
  await p.getByRole('button', { name: 'Pasar a «Ingresada a Afore»' }).click();
  await p.locator('text=Todavía no se puede').waitFor();
  console.log('ingresar sin documentos →', (await p.getByRole('alert').filter({ hasText: 'Todavía' }).innerText()).replace(/\n/g, ' | '));
  await p.screenshot({ path: '/tmp/rpd-cap-7-siguiente-paso.png', fullPage: true });
  // Bloquear por causa del cliente y regresar
  await p.locator('summary').click();
  await p.getByRole('button', { name: /^Bloqueado o rechazado/ }).click();
  await p.check('input[name=atribuible_cliente]'); await p.fill('#motivo', 'IDE sin biometría; el cliente no ha ido a la Afore');
  await p.getByRole('button', { name: 'Pasar a «Bloqueado o rechazado»' }).click();
  await p.waitForTimeout(1500); await p.reload(); await p.locator('main h1').waitFor(); await p.waitForTimeout(400);
  console.log('bloqueado:', await p.locator('header span[class*=rounded-full]').first().innerText());
  await p.getByRole('button', { name: /^Armando expediente/ }).click();
  await p.getByRole('button', { name: 'Pasar a «Armando expediente»' }).click();
  await p.waitForTimeout(1500); await p.reload(); await p.locator('main h1').waitFor(); await p.waitForTimeout(400);
  console.log('de regreso:', await p.locator('header span[class*=rounded-full]').first().innerText());
  await p.goto(caso + '?tab=seguimiento');
  console.log('línea de tiempo:', (await p.locator('ol li p.text-sm').allInnerTexts()).slice(0, 6));
  await p.screenshot({ path: '/tmp/rpd-cap-8-seguimiento.png', fullPage: true });
  await p.goto(caso + '?tab=imss'); await p.screenshot({ path: '/tmp/rpd-cap-9-imss.png', fullPage: true });
  console.log('errores de página:', errores.length ? errores : 'ninguno');
  await b.close();
})().catch(e => { console.error('FALLÓ:', e.message.split('\n')[0]); process.exit(1); });
