// Recorrido de la calculadora: T1, T4 con cambio de modalidad y caso crítico Ley 73.
// Uso: servidor demo en el puerto 3100.
const { chromium } = require('playwright');
const B = 'http://localhost:3100';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1100 } });
  const errores = []; p.on('pageerror', e => errores.push(e.message));
  const caso = async (nombre, tel, imss, afore) => {
    await p.goto(B + '/prospectos/nuevo'); await p.fill('#nombre', nombre); await p.fill('#whatsapp', tel);
    await p.getByRole('button', { name: 'Dar de alta' }).click(); await p.waitForURL(/\/casos\//);
    const url = p.url().split('?')[0];
    await p.goto(url + '?tab=imss'); await p.locator('#fecha_baja').waitFor();
    for (const [k, v] of Object.entries(imss)) await p.fill('#' + k, v);
    await p.locator('main form').nth(0).getByRole('button', { name: 'Guardar' }).click(); await p.locator('main form').nth(0).getByText('Guardado').waitFor();
    for (const [k, v] of Object.entries(afore)) { if (k.startsWith('sel:')) await p.selectOption('#' + k.slice(4), v); else if (k.startsWith('chk:')) await p.check('#' + k.slice(4)); else await p.fill('#' + k, v); }
    await p.locator('main form').nth(1).getByRole('button', { name: 'Guardar' }).click(); await p.locator('main form').nth(1).getByText('Guardado').waitFor();
    return url;
  };
  const listo = { 'sel:tipo_cuenta': 'registrada', 'sel:estado_ultimo_retiro': 'nunca_retiro', 'chk:ide_vigente': '1' };
  // T1
  const t1 = await caso('Uno T1', '777 200 0001',
    { fecha_baja: '2026-08-01', fecha_primera_alta: '2010-01-01', semanas_cotizadas: '400', bimestres_cotizados: '20', sbc_ultimo: '500' },
    { fecha_apertura_cuenta: '2022-10-01', saldo_rcv: '100000', ...listo });
  await p.goto(t1 + '?tab=calculo'); await p.getByRole('button', { name: 'Calcular' }).click();
  await p.locator('text=Puedes retirar').waitFor();
  console.log('T1 →', await p.locator('main span[class*=rounded-full]').filter({ hasText: /Apto|Todavía|Califica|elegible/ }).first().innerText(), '·', (await p.locator('p.bg-brand-tint').innerText()).slice(0, 160));
  await p.screenshot({ path: '/tmp/rpd-cap-13-calculo-t1.png', fullPage: true });
  // T4: A y B, por defecto B; elegir A
  const t4 = await caso('Cuatro T4', '777 200 0004',
    { fecha_baja: '2026-08-01', fecha_primera_alta: '2010-01-01', semanas_cotizadas: '1000', bimestres_cotizados: '60', sbc_ultimo: '300', sbc_promedio_250: '300' },
    { fecha_apertura_cuenta: '2016-01-01', saldo_rcv: '500000', ...listo });
  await p.goto(t4 + '?tab=calculo'); await p.getByRole('button', { name: 'Calcular' }).click();
  await p.locator('text=Modalidad B').waitFor(); await p.waitForTimeout(500);
  const montos = await p.locator('p.cifra.font-display').allInnerTexts();
  console.log('T4 montos A | B:', montos.join(' | '), '· elegida:', await p.locator('text=Elegida').locator('xpath=ancestor::div[contains(@class,"rounded")][1]//h2').innerText().catch(() => '?'));
  await p.getByRole('button', { name: 'Elegir modalidad A' }).click(); await p.waitForTimeout(1500); await p.reload(); await p.locator('text=Modalidad A').waitFor();
  console.log('tras elegir A:', (await p.locator('p.bg-brand-tint').innerText()).slice(0, 70), '· cálculos anteriores:', await p.locator('text=Cálculos anteriores').count());
  await p.screenshot({ path: '/tmp/rpd-cap-14-calculo-ab.png', fullPage: true });
  // Caso crítico Ley 97: 58 años no aplica sin CURP; usamos L73 con 560 semanas → crítico
  const crit = await caso('Crítico L73', '777 200 0009',
    { fecha_baja: '2026-08-01', fecha_primera_alta: '1990-01-01', semanas_cotizadas: '560', bimestres_cotizados: '60', sbc_ultimo: '500' },
    { fecha_apertura_cuenta: '2016-01-01', saldo_rcv: '200000', ...listo });
  await p.goto(crit + '?tab=calculo'); await p.getByRole('button', { name: 'Calcular' }).click();
  await p.locator('text=Impacto en la pensión').waitFor();
  console.log('L73 560 semanas →', await p.locator('main span[class*=rounded-full]').filter({ hasText: /Apto|Todavía|Califica|elegible/ }).first().innerText(), '·', await p.locator('text=Impacto en la pensión >> xpath=ancestor::div[contains(@class,"rounded")][1]//li').first().innerText());
  await p.goto(B + '/hoy'); await p.locator('#alertas').waitFor();
  console.log('alerta en Hoy:', (await p.locator('text=pone en riesgo la pensión').count()) > 0);
  // Ahora el caso T1 puede pasar a Precalificado sin dictamen
  await p.goto(t1 + '?tab=resumen'); await p.locator('text=Siguiente paso').waitFor();
  console.log('T1 Precalificado sin faltantes:', (await p.getByRole('button', { name: /^Precalificado/ }).innerText()).trim() === 'Precalificado');
  console.log('errores de página:', errores.length ? errores : 'ninguno');
  await b.close();
})().catch(e => { console.error('FALLÓ:', e.message.split('\n')[0]); process.exit(1); });
