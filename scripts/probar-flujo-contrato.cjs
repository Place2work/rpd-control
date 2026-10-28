// Contrato desde plantilla (fase 4) con datos FICTICIOS: llena cliente, finado, beneficiaria y
// condiciones de un caso de fallecimiento, y genera contrato y aviso. Servidor demo en 3100.
const { chromium } = require('playwright');
const fs = require('node:fs');
const B = 'http://localhost:3100';
const CASO = process.env.CASO ?? '00000000-0000-0000-0000-0000000000f1';
const RETIRO = process.env.RETIRO ?? '00000000-0000-0000-0000-0000000000f2';
const SALIDA = process.env.SALIDA ?? '.';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1500 } });
  const errores = []; p.on('pageerror', e => errores.push(e.message));
  const forma = (campo) => p.locator('form', { has: p.locator(`#${campo}`) }).first();
  const guardar = async (f) => { await f.getByRole('button', { name: 'Guardar' }).click(); await f.getByText('Guardado').waitFor(); };
  try {
    await p.goto(`${B}/casos/${CASO}?tab=contrato`);
    console.log('faltan al inicio:', await p.locator('li').filter({ hasText: /CURP|Domicilio|Pago único|Advertencias/ }).count());
    let f = forma('domicilio');
    await f.locator('#domicilio').fill('Calle Falsa No. 123, Col. Centro, C.P. 62000, Cuernavaca, Morelos');
    await f.locator('#email').fill('ana.prueba@ejemplo.com'); await guardar(f);
    f = forma('parentesco_cliente');
    await f.locator('#nombre').fill('Juan Gómez Pérez'); await f.locator('#parentesco_cliente').fill('hija');
    await f.locator('#curp').fill('GOPJ500505HMSMRN0'); await f.getByRole('button', { name: 'Guardar' }).click();
    await f.getByText(/CURP/).last().waitFor(); console.log('CURP mala del finado: rechazada');
    await f.locator('#curp').fill('GOPJ500505HMSMRN01'); await f.locator('#nss').fill('12345678903');
    await f.locator('#fecha_defuncion').fill('2025-10-03'); await f.locator('#afore').fill('Afore de prueba'); await guardar(f);
    f = forma('relacion');
    await f.locator('#nombre').fill('María López Pérez'); await f.locator('#curp').fill('LOPM550303MMSPRR06');
    await f.locator('#relacion').fill('madre de EL CLIENTE y cónyuge supérstite del finado Juan Gómez Pérez');
    await f.locator('#domicilio').fill('Av. Siempre Viva No. 742, C.P. 62100, Cuernavaca, Morelos'); await guardar(f);
    f = forma('contrato_advertencias');
    await f.locator('#honorario_fijo').fill('10000');
    await f.locator('#contrato_regularizacion').fill('el estado civil asentado en el acta de defunción');
    await f.locator('#contrato_advertencias').fill('El finado dejó de cotizar antes de cumplir 60 años; existe riesgo de negativa.\nEl acta de defunción asienta un estado civil que debe corregirse.\nLas cifras comunicadas son estimaciones.');
    await guardar(f);
    await p.reload();
    console.log('estado:', (await p.getByText(/Listo para generar|Falta capturar/).allInnerTexts()).join(' | '));
    for (const doc of ['contrato', 'aviso_privacidad']) {
      const r = await p.request.get(`${B}/api/casos/${CASO}/contrato?doc=${doc}`);
      console.log(doc, r.status(), r.headers()['content-type']);
      if (r.ok()) fs.writeFileSync(`${SALIDA}/fallec-${doc}.pdf`, await r.body());
    }
    await p.goto(`${B}/casos/${RETIRO}?tab=contrato`);
    console.log('retiro:', (await p.getByText(/Listo para generar|Falta capturar|todavía no tiene plantilla/).allInnerTexts()).join(' | '));
    const r = await p.request.get(`${B}/api/casos/${RETIRO}/contrato?doc=contrato`);
    console.log('retiro contrato', r.status()); if (r.ok()) fs.writeFileSync(`${SALIDA}/retiro-contrato.pdf`, await r.body());
  } catch (e) { console.log('FALLÓ:', e.message.split('\n')[0]); await p.screenshot({ path: `${SALIDA}/fallo.png`, fullPage: true }); }
  console.log('errores de página:', errores.length ? errores : 'ninguno');
  await b.close();
})();
