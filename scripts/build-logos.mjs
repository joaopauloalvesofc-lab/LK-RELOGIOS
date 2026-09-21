// Gera os SVGs de marca usados inline no site (src/svg/*.svg).
//  - lk.svg: monograma LK redesenhado a partir das bordas medidas na referência 6
//    (varredura de pixels com subpixel; origem no canto superior esquerdo do L).
//  - relogios.svg: palavra "RELÓGIOS" com os contornos da Michroma (estilo Microgramma)
//    engrossados por traço, para chegar à haste de 0,20 × altura das maiúsculas da referência.
//  - marca-*.svg: logotipos oficiais (Wikimedia) em monocromático e com viewBox justo.
import fs from 'node:fs';
import opentype from 'opentype.js';
import puppeteer from 'puppeteer-core';

const out = (name, svg) => { fs.writeFileSync(`src/svg/${name}.svg`, svg.trim() + '\n'); console.log('src/svg/' + name + '.svg', svg.length, 'bytes'); };

// ---------- LK ----------
// Monograma do cabeçalho da referência 1 (bordas medidas com subpixel; origem no canto superior
// esquerdo do L, altura 48,3). K com haste vertical inteira; o pé do L encosta nela.
// Traço uniforme de ~9,4 nas hastes, no pé, no braço e na perna.
const lkPath = [
  'M0 0H9.3V39.2H29V0H38.4V18.3L58.4 0H72.6L48.2 22.7L73.3 48.3H59.9L38.4 26.5V48.3H0Z',
].join('');
out('lk', `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 73.3 48.3" class="lk" aria-hidden="true" focusable="false">
  <path d="${lkPath}" fill="currentColor"/>
</svg>`);

// ---------- RELÓGIOS ----------
const font = opentype.loadSync('source/Michroma-Regular.ttf');
const size = 1000;                       // unidades do desenho
const stroke = 115 / 2048 * size;        // +115 un. na haste: 192 → 307 (0,20 da altura de caixa-alta)
const p = font.getPath('RELÓGIOS', 0, 0, size);
const bb = p.getBoundingBox();
const pad = stroke / 2;
const vx = bb.x1 - pad, vy = bb.y1 - pad, vw = bb.x2 - bb.x1 + stroke, vh = bb.y2 - bb.y1 + stroke;
const d = p.toPathData(1);
out('relogios', `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx.toFixed(1)} ${vy.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}" class="wordmark" aria-hidden="true" focusable="false">
  <path d="${d}" fill="currentColor" stroke="currentColor" stroke-width="${stroke.toFixed(1)}" stroke-linejoin="miter" stroke-miterlimit="4"/>
</svg>`);
// Proporções úteis para o CSS: altura da caixa-alta sem acento, dentro do viewBox.
const cap = 1536 / 2048 * size + stroke;
console.log(`  relogios: viewBox ${vw.toFixed(1)}×${vh.toFixed(1)}, caixa-alta ${cap.toFixed(1)} (${(cap / vh).toFixed(3)} da altura)`);

// ---------- Marcas ----------
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const page = await browser.newPage();
const marcas = [
  ['omega', 'omega-a.svg', []],
  ['orient', 'orient.svg', []],
  ['casio', 'casio.svg', []],
  ['seiko', 'seiko.svg', []],
  ['gshock', 'gshock.svg', ['#ed1c24']],   // remove o traço vermelho; fica só "G-SHOCK"
];
for (const [name, file, drop] of marcas) {
  const src = fs.readFileSync(`source/logos/${file}`, 'utf8');
  await page.setContent(`<!doctype html><body>${src.replace(/<\?xml[^>]*>|<!DOCTYPE[^>]*>/g, '')}</body>`);
  const res = await page.evaluate((drop) => {
    const svg = document.querySelector('svg');
    const shapes = [...svg.querySelectorAll('path,polygon,rect,circle,ellipse,polyline')];
    const keep = [];
    for (const el of shapes) {
      const fill = (getComputedStyle(el).fill || '').toLowerCase();
      const hex = fill.startsWith('rgb') ? '#' + fill.match(/\d+/g).slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('') : fill;
      if (drop.includes(hex) || fill === 'none') continue;
      if (getComputedStyle(el).display === 'none') continue;
      const bb = el.getBBox();
      if (bb.width * bb.height < 2) continue;              // descarta resíduos de exportação (pontinhos soltos)
      keep.push(el);
    }
    // caixa justa no espaço do SVG raiz, considerando transforms
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    const root = svg.getScreenCTM().inverse();
    const parts = [];
    for (const el of keep) {
      const b = el.getBBox();
      const m = root.multiply(el.getScreenCTM());
      for (const [px, py] of [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]]) {
        const q = new DOMPoint(px, py).matrixTransform(m);
        x1 = Math.min(x1, q.x); y1 = Math.min(y1, q.y); x2 = Math.max(x2, q.x); y2 = Math.max(y2, q.y);
      }
      const rule = getComputedStyle(el).fillRule;
      const clone = el.cloneNode(true);
      for (const a of ['class', 'id', 'style', 'fill', 'opacity']) clone.removeAttribute(a);
      if (rule === 'evenodd') clone.setAttribute('fill-rule', 'evenodd');
      const t = `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`;
      const isIdentity = Math.abs(m.a - 1) < 1e-6 && Math.abs(m.d - 1) < 1e-6 && !m.b && !m.c && !m.e && !m.f;
      if (!isIdentity) clone.setAttribute('transform', t.replace(/(\.\d{4})\d+/g, '$1'));
      parts.push(clone.outerHTML.replace(/ xmlns="[^"]*"/g, ''));
    }
    return { box: [x1, y1, x2 - x1, y2 - y1], parts };
  }, drop);
  const [bx, by, bw, bh] = res.box.map(v => +v.toFixed(2));
  const body = res.parts.join('\n  ').replace(/\s+sodipodi:[a-z-]+="[^"]*"|\s+inkscape:[a-z-]+="[^"]*"/g, '');
  out(`marca-${name}`, `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bx} ${by} ${bw} ${bh}" fill="currentColor" aria-hidden="true" focusable="false">
  ${body}
</svg>`);
  console.log(`  ${name}: proporção ${(bw / bh).toFixed(3)}`);
}
await browser.close();

// ---------- Favicons (a partir do monograma) ----------
{
  const lk = fs.readFileSync('src/svg/lk.svg', 'utf8');
  const inner = lk.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/currentColor/g, '#0a0a0a');
  // monograma centralizado num quadrado 64×64 (largura útil 44)
  const s = 44 / 73.3, w = 73.3 * s, h = 48.3 * s;
  const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#fcfbf9"/><g transform="translate(${((64 - w) / 2).toFixed(2)} ${((64 - h) / 2).toFixed(2)}) scale(${s.toFixed(5)})">${inner}</g></svg>`;
  fs.mkdirSync('assets/icons', { recursive: true });
  fs.writeFileSync('assets/icons/favicon.svg', favicon);
  const sharp = (await import('sharp')).default;
  await sharp(Buffer.from(favicon), { density: 300 }).resize(32, 32).png().toFile('assets/icons/favicon-32.png');
  const touch = favicon.replace('rx="14"', 'rx="0"');
  await sharp(Buffer.from(touch), { density: 600 }).resize(180, 180).flatten({ background: '#fcfbf9' }).png().toFile('assets/icons/apple-touch-icon.png');
  console.log('assets/icons: favicon.svg, favicon-32.png, apple-touch-icon.png');
}
