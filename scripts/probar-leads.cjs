// Prueba POST /api/leads contra el servidor local (puerto 3100) con LEADS_HMAC_SECRETO=prueba-local.
// También sirve de ejemplo para el sitio: así se firma la petición.
const { createHmac } = require('node:crypto');
const B = process.env.B ?? 'http://localhost:3100';
const SECRETO = process.env.LEADS_HMAC_SECRETO ?? 'prueba-local';
const enviar = async (datos, { secreto = SECRETO, ts = Math.floor(Date.now() / 1000) } = {}) => {
  const cuerpo = JSON.stringify(datos);
  const firma = 'sha256=' + createHmac('sha256', secreto).update(`${ts}.${cuerpo}`).digest('hex');
  const r = await fetch(B + '/api/leads', { method: 'POST', body: cuerpo, headers: { 'content-type': 'application/json', 'x-rpd-timestamp': String(ts), 'x-rpd-firma': firma } });
  return [r.status, await r.json()];
};
(async () => {
  const tel = '55' + String(Date.now()).slice(-8);
  const lead = { nombre: 'Lucía', apellido_paterno: 'Web', whatsapp: tel, servicio: 'retiro', fecha_baja: '2026-09-20', privacidad_aceptada: true, ip_cliente: '201.141.10.20', utm: { source: 'google' }, mensaje: 'Me dieron de baja en septiembre' };
  console.log('nuevo:', ...(await enviar(lead)));
  console.log('repetido:', ...(await enviar(lead)));
  console.log('otro secreto:', ...(await enviar(lead, { secreto: 'x' })));
  console.log('firma vieja:', ...(await enviar(lead, { ts: Math.floor(Date.now() / 1000) - 900 })));
  console.log('sin privacidad:', ...(await enviar({ ...lead, privacidad_aceptada: false })));
})();
