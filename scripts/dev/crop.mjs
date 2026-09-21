// Recorta e amplia um trecho de uma referência, para análise visual.
import sharp from 'sharp';
const [,, ref, x, y, w, h, scale = '2', out] = process.argv;
await sharp(`source/referencias/ref-${ref}.png`)
  .extract({ left: +x, top: +y, width: +w, height: +h })
  .resize({ width: Math.round(+w * +scale), kernel: 'lanczos3' })
  .png().toFile(out);
console.log('ok', out);
