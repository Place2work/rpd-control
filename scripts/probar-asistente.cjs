// Asistente de precalificación en 4 pasos (fase 4) con datos FICTICIOS (caso T1).
const { chromium } = require('playwright');
const B = 'http://localhost:3100';
const CASO = process.env.CASO ?? '00000000-0000-0000-0000-0000000000f2';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  const errores = []; p.on('pageerror', e => errores.push(e.message));
  const llenar = async (id, v) => p.fill(`#a-${id}`, v);
  const seguir = async (paso) => { await p.getByRole('button', { name: /Guardar y seguir/ }).click(); await p.locator('[aria-current=step]').filter({ hasText: paso }).waitFor(); };
  try {
    await p.goto(`${B}/casos/${CASO}?tab=calculo`, { waitUntil: 'networkidle' });
    const resumen = p.getByText('Revisar o cambiar los datos paso a paso'); if (await resumen.count()) await resumen.click();
    await llenar('fecha_baja', '2026-08-01'); await seguir('Cuenta y semanas');
    await llenar('fecha_primera_alta', '2010-01-01'); await llenar('semanas_cotizadas', '400');
    await p.selectOption('#a-afore', { index: 1 }); await llenar('fecha_apertura_cuenta', '2022-01-01');
    await p.selectOption('#a-tipo_cuenta', 'registrada'); await p.selectOption('#a-estado_ultimo_retiro', 'nunca_retiro'); await p.check('#a-ide_vigente');
    await seguir('Salarios y saldos');
    await llenar('sbc_ultimo', 'abc'); await p.getByRole('button', { name: /Guardar y seguir/ }).click();
    await p.getByText('Número no válido').waitFor(); console.log('SBC con letras: rechazado sin perder lo capturado');
    await llenar('sbc_ultimo', '500'); await llenar('saldo_rcv', '100,000'); await seguir('Resultado');
    await p.getByRole('button', { name: 'Calcular precalificación' }).click();
    await p.getByText(/Puedes retirar hasta/).waitFor();
    console.log('resultado:', await p.getByText(/Puedes retirar hasta/).innerText());
    await p.goto(`${B}/casos/${CASO}?tab=imss`);
    console.log('régimen y bimestres en IMSS y Afore:', await p.locator('#regimen').inputValue(), await p.locator('#bimestres_cotizados').inputValue());
    await p.setViewportSize({ width: 390, height: 900 }); await p.goto(`${B}/casos/${CASO}?tab=calculo`);
    await p.getByText('Revisar o cambiar los datos paso a paso').click();
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth); console.log('ancho en celular:', ancho);
    await p.screenshot({ path: process.env.CAP ?? 'asistente.png' });
  } catch (e) { console.log('FALLÓ:', e.message.split('\n')[0]); await p.screenshot({ path: 'fallo.png', fullPage: true }); }
  console.log('errores de página:', errores.length ? errores : 'ninguno');
  await b.close();
})();
