// Sobrepõe uma grade com coordenadas numa referência, para medir posições.
import sharp from 'sharp';
const [,, ref, x, y, w, h, scale = '1', step = '50', out] = process.argv;
const s = +scale, st = +step, W = +w, H = +h, OW = Math.round(W * s), OH = Math.round(H * s);
let lines = '';
for (let gx = Math.ceil(+x / st) * st; gx < +x + W; gx += st) {
  const px = (gx - +x) * s;
  lines += `<line x1="${px}" y1="0" x2="${px}" y2="${H * s}" stroke="${gx % (st * 2) ? '#f0f' : '#08f'}" stroke-width="1" opacity=".55"/><text x="${px + 2}" y="10" font-size="10" fill="#f0f" font-family="monospace">${gx}</text>`;
}
for (let gy = Math.ceil(+y / st) * st; gy < +y + H; gy += st) {
  const py = (gy - +y) * s;
  lines += `<line x1="0" y1="${py}" x2="${W * s}" y2="${py}" stroke="${gy % (st * 2) ? '#f0f' : '#08f'}" stroke-width="1" opacity=".55"/><text x="2" y="${py - 2}" font-size="10" fill="#08f" font-family="monospace">${gy}</text>`;
}
const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${OW}" height="${OH}">${lines}</svg>`);
await sharp(`source/referencias/ref-${ref}.png`).extract({ left: +x, top: +y, width: W, height: H })
  .resize({ width: OW, height: OH, fit: "fill" }).composite([{ input: svg }]).png().toFile(out);
console.log('ok', out);
