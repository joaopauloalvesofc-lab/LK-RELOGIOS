// Compara uma tela da referência com a seção equivalente do site, lado a lado e sobrepostas.
// A referência é escalada pela largura útil (margem 28u) e alinhada pelo ponto-âncora.
// uso: node scripts/dev/compare.mjs <cfg-json> <saida-prefixo>
//  cfg = { ref, refGutter, refContent, refAnchorY, refY0, refY1, url, sel, anchorSel, alturaCss, largura }
import sharp from 'sharp';
import puppeteer from 'puppeteer-core';
const cfg = JSON.parse(process.argv[2]);
const out = process.argv[3];
const W = cfg.largura || 393, D = 2;
const u = W / 393, g = 28 * u;
const s = (W - 2 * g) / cfg.refContent;                  // escala ref → css
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: W, height: 900, deviceScaleFactor: D, isMobile: true, hasTouch: true });
await page.goto(cfg.url, { waitUntil: 'networkidle0' });
await page.evaluate(async () => { document.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager'; }); await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
if (cfg.antes) await page.evaluate(cfg.antes);
await new Promise(r => setTimeout(r, 400));
// âncora: topo das maiúsculas do elemento (retângulo do texto menos o espaço acima da caixa-alta)
const anc = await page.evaluate((sel) => {
  const el = document.querySelector(sel);
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const c = document.createElement('canvas').getContext('2d');
  c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const m = c.measureText('H');
  const fs = parseFloat(cs.fontSize), lh = cs.lineHeight === 'normal' ? fs * 1.2 : parseFloat(cs.lineHeight);
  const asc = m.fontBoundingBoxAscent, desc = m.fontBoundingBoxDescent;
  const capTop = r.top + scrollY + (lh - (asc + desc)) / 2 + (asc - m.actualBoundingBoxAscent);
  return capTop;
}, cfg.anchorSel);
const alturaCss = cfg.alturaCss || (cfg.refY1 - cfg.refY0) * s;
const topCss = anc - (cfg.refAnchorY - cfg.refY0) * s;
await page.evaluate(() => { document.querySelector('[data-topo]')?.classList.remove('oculto', 'rolado'); });
const shot = await page.screenshot({ clip: { x: 0, y: Math.max(0, topCss), width: W, height: alturaCss }, captureBeyondViewport: true });
await browser.close();
// referência: recorte vertical [refY0, refY1], escala s, deslocamento horizontal para a margem
const refW = Math.round(cfg.refW * s * D), refH = Math.round(alturaCss * D);
const scaled = await sharp(`source/referencias/ref-${cfg.ref}.png`)
  .extract({ left: 0, top: cfg.refY0, width: cfg.refW, height: Math.min(cfg.refY1 - cfg.refY0, 99999) })
  .resize({ width: refW, kernel: 'lanczos3' }).png().toBuffer();
const dx = Math.round((g - cfg.refGutter * s) * D);
const meta = await sharp(scaled).metadata();
const canvasRef = await sharp({ create: { width: W * D, height: refH, channels: 3, background: '#fcfbf9' } })
  .composite([{ input: await sharp(scaled).extract({ left: Math.max(0, -dx), top: 0, width: Math.min(meta.width - Math.max(0, -dx), W * D - Math.max(0, dx)), height: Math.min(meta.height, refH) }).toBuffer(), left: Math.max(0, dx), top: 0 }])
  .png().toBuffer();
const mine = await sharp(shot).resize({ width: W * D, height: refH, fit: 'fill' }).png().toBuffer();
await sharp({ create: { width: W * D * 2 + 20, height: refH, channels: 3, background: '#ff00ff' } })
  .composite([{ input: canvasRef, left: 0, top: 0 }, { input: mine, left: W * D + 20, top: 0 }]).png().toFile(`${out}-lado.png`);
// sobreposição: referência em ciano, site em magenta (onde coincidem fica cinza/preto)
const a = await sharp(canvasRef).greyscale().raw().toBuffer();
const b = await sharp(mine).greyscale().raw().toBuffer();
const o = Buffer.alloc(W * D * refH * 3);
for (let i = 0; i < W * D * refH; i++) { o[i * 3] = a[i]; o[i * 3 + 1] = b[i]; o[i * 3 + 2] = b[i]; }
await sharp(o, { raw: { width: W * D, height: refH, channels: 3 } }).png().toFile(`${out}-sobre.png`);
console.log(JSON.stringify({ s: +s.toFixed(4), dx: dx / D, anc: +anc.toFixed(1), topCss: +topCss.toFixed(1), alturaCss: +alturaCss.toFixed(1) }));
