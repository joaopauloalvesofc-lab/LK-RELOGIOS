// Caixa delimitadora dos pixels escuros (luminância < limiar) numa região de uma referência.
import sharp from 'sharp';
const [,, ref, x, y, w, h, thr = '128'] = process.argv;
const { data, info } = await sharp(`source/referencias/ref-${ref}.png`).extract({ left: +x, top: +y, width: +w, height: +h }).raw().toBuffer({ resolveWithObject: true });
let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
for (let j = 0; j < info.height; j++) for (let i = 0; i < info.width; i++) {
  const k = (j * info.width + i) * info.channels;
  const l = 0.2126 * data[k] + 0.7152 * data[k + 1] + 0.0722 * data[k + 2];
  if (l < +thr) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j); }
}
console.log(`x ${+x + x0}..${+x + x1} (w ${x1 - x0 + 1})  y ${+y + y0}..${+y + y1} (h ${y1 - y0 + 1})`);
