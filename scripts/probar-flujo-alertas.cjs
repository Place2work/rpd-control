// Recorrido de alertas: tarea de las 7:00, bandeja, atender, posponer y deduplicación.
// Uso: servidor demo con CRON_SECRETO=local en el puerto 3100.
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const B = 'http://localhost:3100';
const sql = (q) => execSync(`PGPASSWORD=rpd psql -h localhost -U rpd -d rpd_dev -tAc "${q}"`).toString().trim();
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1100 } });
  const errores = []; p.on('pageerror', e => errores.push(e.message));
  const alta = async (nombre, tel, baja) => {
    await p.goto(B + '/prospectos/nuevo'); await p.fill('#nombre', nombre); await p.fill('#whatsapp', tel);
    if (baja) await p.fill('#fecha_baja', baja);
    await p.getByRole('button', { name: 'Dar de alta' }).click(); await p.waitForURL(/\/casos\//);
  };
  const hoy = sql("select (now() at time zone 'America/Mexico_City')::date");
  const menos = (d) => sql(`select ('${hoy}'::date - ${d})::text`);
  await alta('Ana Hoy', '777 100 0001', menos(46));
  await alta('Beto Tres', '777 100 0002', menos(43));
  await alta('Carla Sin Contacto', '777 100 0003', null);
  sql("update casos set created_at = now() - interval '2 days' where persona_id = (select id from personas where nombre = 'Carla Sin Contacto')");
  const r = execSync(`curl -s -X POST -H "Authorization: Bearer local" "${B}/api/cron/diaria?tarea=ALERTAS_DIARIAS"`).toString();
  console.log('tarea 7:00 →', r);
  await p.goto(B + '/hoy'); await p.locator('#alertas').waitFor(); await p.waitForTimeout(500);
  const textos = await p.locator('#alertas ~ div li p.text-sm').allInnerTexts();
  console.log('bandeja:', textos);
  console.log('campana:', await p.locator('a[href="/hoy#alertas"] span.cifra').innerText().catch(() => 'sin número'));
  const wa = await p.locator('#alertas ~ div li').first().getByRole('link', { name: 'WhatsApp' }).getAttribute('href');
  console.log('WhatsApp de la crítica:', decodeURIComponent(wa).slice(0, 110) + '…');
  await p.screenshot({ path: '/tmp/rpd-cap-12-alertas.png', fullPage: true });
  await p.locator('#alertas ~ div li').first().getByRole('button', { name: 'Atendida' }).click(); await p.waitForTimeout(1200);
  await p.locator('#alertas ~ div li').first().getByRole('button', { name: '3 d' }).click(); await p.waitForTimeout(1200);
  await p.reload(); await p.locator('#alertas').waitFor();
  console.log('después de atender una y posponer otra:', await p.locator('#alertas ~ div li').count(), 'en la bandeja');
  await p.getByRole('button', { name: 'Revisar ahora' }).click(); await p.locator('text=/alertas nuevas|Sin alertas nuevas/').waitFor();
  console.log('segunda revisión:', await p.locator('text=/alertas nuevas|Sin alertas nuevas/').innerText());
  console.log('estados en la base:', sql("select string_agg(regla || '=' || estado, ', ' order by regla) from alertas"));
  console.log('errores de página:', errores.length ? errores : 'ninguno');
  await b.close();
})().catch(e => { console.error('FALLÓ:', e.message.split('\n')[0]); process.exit(1); });
