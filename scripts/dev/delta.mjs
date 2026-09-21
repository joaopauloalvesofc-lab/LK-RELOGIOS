// Mede, nos dois painéis de um *-lado.png, a caixa dos pixels escuros de cada faixa e mostra
// a diferença (site − referência) em px CSS. uso: node delta.mjs <lado.png> '[[nome,y0,y1,x0,x1,limiar]]'
import sharp from 'sharp';
const [,, arq, faixasJson] = process.argv;
const faixas = JSON.parse(faixasJson);
const { data, info } = await sharp(arq).greyscale().raw().toBuffer({ resolveWithObject: true });
const D = 2, W = (info.width - 20) / 2;
const caixa = (ox, y0, y1, x0, x1, lim) => {
  let a = 1e9, b = 1e9, c = -1, d = -1;
  for (let y = y0 * D; y < Math.min(info.height, y1 * D); y++) for (let x = x0 * D; x < x1 * D; x++) {
    if (data[y * info.width + ox + x] < lim) { a = Math.min(a, x); c = Math.max(c, x); b = Math.min(b, y); d = Math.max(d, y); }
  }
  return c < 0 ? null : { x: a / D, y: b / D, w: (c - a + 1) / D, h: (d - b + 1) / D };
};
for (const [nome, y0, y1, x0 = 0, x1 = 393, lim = 128] of faixas) {
  const r = caixa(0, y0, y1, x0, x1, lim), m = caixa(W + 20, y0, y1, x0, x1, lim);
  if (!r || !m) { console.log(nome.padEnd(22), 'vazio', !!r, !!m); continue; }
  const f = v => (v >= 0 ? '+' : '') + v.toFixed(1);
  console.log(nome.padEnd(22), `ref y ${r.y.toFixed(1)} h ${r.h.toFixed(1)} x ${r.x.toFixed(1)} w ${r.w.toFixed(1)} | site Δy ${f(m.y - r.y)} Δh ${f(m.h - r.h)} Δx ${f(m.x - r.x)} Δw ${f(m.w - r.w)}`);
}
