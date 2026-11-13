// Renderiza el video de una lección desde content/academia/videos/fuentes/<CLAVE>.html a
// content/academia/videos/<CLAVE>.mp4 (1920×1080, 30 cps). La página expone window.DURACION y window.render(t).
// Uso: node scripts/academia-video.cjs R1-02   (requiere Playwright con Chromium y ffmpeg)
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const clave = process.argv[2];
if (!/^(N0|R1|R2|P1|P2)-\d\d$/.test(clave ?? '')) { console.error('Uso: node scripts/academia-video.cjs R1-02'); process.exit(1); }
const dir = path.join(__dirname, '..', 'content', 'academia', 'videos');
(async () => {
  const FPS = 30;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + path.join(dir, 'fuentes', `${clave}.html`)); await p.evaluate(() => document.fonts.ready);
  const dur = await p.evaluate(() => window.DURACION);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '20', '-movflags', '+faststart', path.join(dir, `${clave}.mp4`)], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = 0; f < Math.round(dur * FPS); f++) {
    await p.evaluate((t) => window.render(t), f / FPS);
    const buf = await p.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await b.close();
  console.log(`ok: ${clave}.mp4 · ${dur} s (actualiza duracion_seg en el encabezado de la lección)`);
})();
