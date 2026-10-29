// Configuración (10.9) en modo demostración: usuarios, parámetros, días inhábiles, plantillas,
// mensajes, esquemas de comisión y bitácora. Datos ficticios. Servidor demo en el puerto 3100.
const { chromium } = require('playwright');
const B = 'http://localhost:3100';
const CORREO = `laura.${Date.now()}@ejemplo.com`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  const errores = []; p.on('pageerror', e => errores.push(e.message));
  p.on('dialog', d => d.accept());
  const ir = async (s) => { await p.goto(`${B}/configuracion?seccion=${s}`, { waitUntil: 'networkidle' }); };
  const forma = (id) => p.locator('form', { has: p.locator(`#${id}`) });
  try {
    // Usuarios
    await ir('usuarios');
    let f = forma('email');
    await f.locator('#nombre').fill('Laura Asesora Prueba'); await f.locator('#email').fill(CORREO);
    await f.getByRole('button', { name: 'Enviar invitación' }).click(); await f.getByText('Guardado').waitFor();
    await p.reload({ waitUntil: 'networkidle' });
    const fila = p.locator('li', { hasText: CORREO });
    console.log('usuario invitado:', (await fila.locator('p').first().innerText()), '·', await fila.locator('span').filter({ hasText: /Asesor|Vendedor/ }).first().innerText());
    await fila.getByText('Editar').click();
    await fila.locator('#rol').selectOption('vendedor'); await fila.getByRole('button', { name: 'Guardar' }).click(); await fila.getByText('Guardado').waitFor();
    await fila.getByRole('button', { name: 'Quitar acceso' }).click(); await p.locator('li', { hasText: CORREO }).getByText('Sin acceso').waitFor();
    console.log('rol cambiado a vendedor y acceso quitado');
    f = forma('email'); await f.locator('#nombre').fill('Otra'); await f.locator('#email').fill(CORREO);
    await f.getByRole('button', { name: 'Enviar invitación' }).click(); await f.getByText('ya es usuario').waitFor(); console.log('correo repetido: rechazado');

    // Parámetros
    await ir('parametros');
    const uma = p.locator('li', { hasText: 'UMA_MENSUAL' });
    await uma.getByText(/^Cambiar/).click();
    await uma.locator('#valor').fill('3,700');
    console.log('fecha mínima del campo (no deja elegir el pasado):', await uma.locator('#vigente_desde').getAttribute('min'));
    await uma.locator('#vigente_desde').fill('2027-02-01'); await uma.getByRole('button', { name: 'Programar' }).click();
    await p.waitForTimeout(1200); await p.reload({ waitUntil: 'networkidle' });
    console.log('UMA:', (await p.locator('li', { hasText: 'UMA_MENSUAL' }).innerText()).replace(/\n/g, ' | ').slice(0, 160));
    const hon = p.locator('li', { hasText: 'HONORARIO_RETIRO_PCT' });
    console.log('honorario se ve como:', await hon.locator('p.cifra').innerText());

    // Días inhábiles
    await ir('inhabiles');
    f = forma('descripcion'); await f.locator('#fecha').fill('2026-12-24'); await f.locator('#descripcion').fill('Prueba de día inhábil');
    await f.getByRole('button', { name: 'Agregar' }).click(); await f.getByText('Guardado').waitFor(); await p.reload({ waitUntil: 'networkidle' });
    const d = p.locator('li', { hasText: 'Prueba de día inhábil' }); await d.getByRole('button', { name: 'Desactivar' }).click();
    await p.locator('li', { hasText: 'Prueba de día inhábil' }).getByRole('button', { name: 'Activar' }).waitFor(); console.log('día inhábil agregado y desactivado');

    // Plantillas
    await ir('plantillas');
    const card = p.locator('[class*=rounded]', { has: p.getByText('Contrato de retiro parcial por desempleo', { exact: true }) }).filter({ has: p.getByText('Editar (crea una versión nueva)') }).last();
    await card.getByText('Editar (crea una versión nueva)').click();
    const ta = card.locator('textarea#cuerpo');
    const original = await ta.inputValue();
    await ta.fill(original.replace('{{cliente.nombre}}', '{{cliente.nombr}}'));
    await card.getByRole('button', { name: 'Guardar versión nueva' }).click(); await card.getByText(/Variable desconocida/).waitFor(); console.log('variable mal escrita: rechazada');
    await ta.fill(original.replace('Se firma por duplicado', 'Se firma por duplicado (versión de prueba)'));
    await card.locator('input#vigente_desde').fill('2026-11-01');
    await card.getByRole('button', { name: 'Guardar versión nueva' }).click(); await p.waitForTimeout(1500); await p.reload({ waitUntil: 'networkidle' });
    console.log('plantillas:', (await p.getByText(/Historial:/).first().innerText()));

    // Mensajes
    await ir('mensajes');
    const m = p.locator('form', { has: p.locator('#cuerpo') }).first();
    const cuerpo = await m.locator('#cuerpo').inputValue();
    await m.locator('#cuerpo').fill(cuerpo + ' {saldo}'); await m.getByRole('button', { name: 'Guardar' }).click(); await m.getByText(/no llena/).waitFor(); console.log('variable de mensaje desconocida: rechazada');
    await m.locator('#cuerpo').fill(cuerpo); await m.getByRole('button', { name: 'Guardar' }).click(); await m.getByText('Guardado').waitFor();

    // Comisiones
    await ir('comisiones');
    const v = p.locator('[class*=rounded]', { has: p.getByText(/de lo que paga la Afore/) }).filter({ has: p.getByText('Cambiar (crea una versión nueva)') }).last();
    await v.getByText('Cambiar (crea una versión nueva)').click();
    await v.locator('#pct').fill('6'); await v.locator('#vigente_desde').fill('2026-12-01');
    await v.getByRole('button', { name: 'Programar' }).click(); await p.waitForTimeout(1200); await p.reload({ waitUntil: 'networkidle' });
    console.log('esquema:', await p.getByText(/versión programada/).first().innerText());

    // Bitácora
    await ir('bitacora');
    console.log('bitácora (primeros renglones):'); for (const r of (await p.locator('tbody tr').allInnerTexts()).slice(0, 8)) console.log('  ', r.replace(/\t/g, ' · '));
    await p.screenshot({ path: process.env.CAP ?? 'config.png', fullPage: true });
  } catch (e) { console.log('FALLÓ:', e.message.split('\n')[0]); await p.screenshot({ path: 'fallo.png', fullPage: true }); }
  console.log('errores de página:', errores.length ? errores : 'ninguno');
  await b.close();
})();
