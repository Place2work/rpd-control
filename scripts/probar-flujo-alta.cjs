// Recorrido completo del alta (fase 1, parte 1) contra Postgres local en modo demostración.
// Uso: npm run db:local -- rpd_dev && RPD_DEMO_SIN_AUTH=1 npx next dev -p 3100, y luego node scripts/probar-flujo-alta.cjs
const { chromium } = require('playwright');
// CURP y NSS ficticios con dígito verificador correcto.
const DIC = "0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";
const dvCurp = c => { let s = 0; for (let i = 0; i < 17; i++) s += DIC.indexOf(c[i]) * (18 - i); return (10 - s % 10) % 10; };
const dvNss = n => { let s = 0; for (let i = 0; i < 10; i++) { let d = +n[i] * (i % 2 ? 2 : 1); if (d > 9) d -= 9; s += d; } return (10 - s % 10) % 10; };
const CURP = "GOMJ800215HMSRRN0" + dvCurp("GOMJ800215HMSRRN0");
const NSS = "1234567890" + dvNss("1234567890");
const B = 'http://localhost:3100';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errores = []; p.on('pageerror', e => errores.push(e.message));
  const t0 = Date.now();
  await p.goto(B + '/prospectos/nuevo');
  await p.fill('#nombre', 'Juana');
  await p.fill('#whatsapp', '777 123 4567');
  await p.fill('#fecha_baja', '2026-10-01');
  await p.getByRole('button', { name: /Apellidos, CURP y NSS/ }).click();
  await p.fill('#apellido_paterno', 'Gómez');
  await p.fill('#curp', CURP.toLowerCase());
  await p.fill('#nss', NSS);
  await p.check('input[name=privacidad]');
  await p.screenshot({ path: '/tmp/rpd-cap-1-alta.png', fullPage: true });
  await p.getByRole('button', { name: 'Dar de alta' }).click();
  await p.waitForURL(/\/casos\/.+nuevo=1/, { timeout: 20000 });
  console.log('alta OK en', ((Date.now() - t0) / 1000).toFixed(1), 's →', new URL(p.url()).pathname);
  console.log('banner:', await p.getByRole('status').innerText());
  console.log('cuenta regresiva:', (await p.locator('text=días para poder retirar').count()) ? 'sí' : 'no');
  await p.screenshot({ path: '/tmp/rpd-cap-2-expediente.png', fullPage: true });
  const casoUrl = p.url().split('?')[0];
  await p.goto(casoUrl + '?tab=datos');
  console.log('NSS enmascarado:', await p.locator('text=•••••••').first().innerText());
  await p.getByRole('button', { name: 'Ver completo' }).nth(1).click();
  await p.waitForSelector('text=Quedó registrado en la bitácora');
  console.log('NSS completo visible:', (await p.locator(`text=${NSS}`).count()) > 0);
  await p.screenshot({ path: '/tmp/rpd-cap-3-datos.png', fullPage: true });
  await p.goto(casoUrl + '?tab=seguimiento');
  await p.fill('#texto', 'Le marqué; manda constancia mañana.');
  await p.getByRole('button', { name: 'Guardar' }).click();
  await p.waitForSelector('text=Le marqué; manda constancia mañana.');
  console.log('nota guardada: sí');
  await p.goto(B + '/prospectos?q=' + NSS);
  console.log('búsqueda por NSS:', await p.locator('text=resultado').first().innerText());
  await p.goto(B + '/prospectos?q=gomez%20juana');
  console.log('búsqueda por nombre:', await p.locator('text=resultado').first().innerText());
  await p.screenshot({ path: '/tmp/rpd-cap-4-lista.png', fullPage: true });
  // Duplicado por teléfono: avisa y permite confirmar.
  await p.goto(B + '/prospectos/nuevo');
  await p.fill('#nombre', 'Pedro'); await p.fill('#whatsapp', '7771234567');
  await p.getByRole('button', { name: 'Dar de alta' }).click();
  await p.waitForSelector('text=Ya hay una persona con ese WhatsApp');
  console.log('aviso duplicado teléfono: sí; valores conservados:', await p.inputValue('#nombre'));
  await p.screenshot({ path: '/tmp/rpd-cap-5-duplicado.png', fullPage: true });
  // Duplicado por NSS: bloquea.
  await p.goto(B + '/prospectos/nuevo');
  await p.fill('#nombre', 'Otro'); await p.fill('#whatsapp', '5550001111');
  await p.getByRole('button', { name: /Apellidos, CURP y NSS/ }).click();
  await p.fill('#nss', NSS);
  await p.getByRole('button', { name: 'Dar de alta' }).click();
  await p.waitForSelector('text=Ya hay una persona registrada con esa CURP o ese NSS');
  console.log('bloqueo duplicado NSS: sí');
  // Errores de validación juntos.
  await p.goto(B + '/prospectos/nuevo');
  await p.getByRole('button', { name: 'Dar de alta' }).click();
  await p.waitForSelector('text=Escribe el nombre');
  console.log('errores visibles:', await p.locator('p.text-critico').allInnerTexts());
  const d = await b.newPage({ viewport: { width: 1440, height: 900 } });
  for (const r of ['hoy', 'casos']) { await d.goto(B + '/' + r); await d.waitForTimeout(500); await d.screenshot({ path: `cap/6-${r}.png`, fullPage: true }); }
  console.log('errores de página:', errores.length ? errores : 'ninguno');
  await b.close();
})().catch(e => { console.error('FALLÓ:', e.message); process.exit(1); });
