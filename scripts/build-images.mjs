// Pipeline de imagens do site LK Relógios.
//
// As únicas fontes de imagem são as referências (source/referencias/ref-N.png, 841–941 px de
// largura). Cada imagem passa por quatro etapas:
//   1. recorte da referência, com limpeza do que estava "queimado" por cima da foto
//      (textos e botões do hero, corações dos cards);
//   2. ampliação 4× com Real-ESRGAN (x4plus), cacheada em source/work/;
//   3. para os relógios e as pedras: fundo normalizado para branco puro (divisão pela cor do
//      fundo), para o CSS aplicar mix-blend-mode: multiply sobre qualquer fundo claro;
//   4. exportação em AVIF e WebP, em várias larguras, para srcset.
//
// Uso: npm run images            (usa o cache de source/work quando existe)
//      npm run images -- --force (refaz tudo)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const FORCE = process.argv.includes('--force');
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7);   // ex.: --only=hero
const etapa = nome => !ONLY || ONLY.split(',').includes(nome);
const WORK = 'source/work';
const OUT = 'assets/img';
const ESRGAN = process.env.REALESRGAN || path.join(os.homedir(), '.local/share/realesrgan/realesrgan-ncnn-vulkan');
fs.mkdirSync(WORK, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- utilidades de pixel

/** Lê uma região da referência como Float32 RGB (0–255). */
async function readRegion(ref, { x, y, w, h }) {
  const { data } = await sharp(`source/referencias/ref-${ref}.png`).removeAlpha()
    .extract({ left: x, top: y, width: w, height: h }).raw().toBuffer({ resolveWithObject: true });
  return { px: Float32Array.from(data), w, h };
}

async function writePng(img, file) {
  const buf = Buffer.from(Uint8ClampedArray.from(img.px));
  await sharp(buf, { raw: { width: img.w, height: img.h, channels: 3 } }).png().toFile(file);
}

const lum = (px, i) => 0.2126 * px[i * 3] + 0.7152 * px[i * 3 + 1] + 0.0722 * px[i * 3 + 2];

/** Filtro de máximo/mínimo separável (quadrado de raio r) sobre a luminância. */
function morph(src, w, h, r, fn) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = src[y * w + x];
    for (let d = -r; d <= r; d++) { const xx = Math.min(w - 1, Math.max(0, x + d)); v = fn(v, src[y * w + xx]); }
    tmp[y * w + x] = v;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = tmp[y * w + x];
    for (let d = -r; d <= r; d++) { const yy = Math.min(h - 1, Math.max(0, y + d)); v = fn(v, tmp[yy * w + x]); }
    out[y * w + x] = v;
  }
  return out;
}

function dilateMask(mask, w, h, r) {
  const f = Float32Array.from(mask);
  const d = morph(f, w, h, r, Math.max);
  return Uint8Array.from(d, v => (v > 0 ? 1 : 0));
}

/**
 * Máscara de texto escuro sobre fundo claro e liso, dentro de uma caixa: fechamento
 * morfológico (máx. depois mín.) apaga os traços finos; o que ficou mais escuro que o
 * fechamento, além de `limiar`, é texto.
 */
function textMask(img, box, r = 5, limiar = 5) {
  const { w, h, px } = img;
  const L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = lum(px, i);
  const closed = morph(morph(L, w, h, r, Math.max), w, h, r, Math.min);
  const m = new Uint8Array(w * h);
  for (let y = box.y; y < box.y + box.h; y++) for (let x = box.x; x < box.x + box.w; x++) {
    const i = y * w + x;
    if (closed[i] - L[i] > limiar) m[i] = 1;
  }
  return m;
}

function rectMask(w, h, { x, y, w: rw, h: rh }, m = new Uint8Array(w * h)) {
  for (let yy = Math.max(0, y); yy < Math.min(h, y + rh); yy++)
    for (let xx = Math.max(0, x); xx < Math.min(w, x + rw); xx++) m[yy * w + xx] = 1;
  return m;
}

const orMask = (...ms) => { const o = new Uint8Array(ms[0].length); for (const m of ms) for (let i = 0; i < o.length; i++) o[i] |= m[i]; return o; };

/**
 * Preenchimento "push-pull": pirâmide de médias ponderadas pelos pixels conhecidos, depois
 * reconstrução bilinear de cima para baixo. Seguido de relaxação de Laplace (Jacobi) dentro
 * da máscara, para um preenchimento harmônico e sem degraus. Serve para fundos desfocados.
 */
function pushPull(px, known, w, h) {
  if (w <= 1 && h <= 1) return;
  const w2 = Math.ceil(w / 2), h2 = Math.ceil(h / 2);
  const p2 = new Float32Array(w2 * h2 * 3), k2 = new Float32Array(w2 * h2);
  let incompleto = false;
  for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
    let ws = 0, r = 0, g = 0, b = 0;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const xx = 2 * x + dx, yy = 2 * y + dy;
      if (xx >= w || yy >= h) continue;
      const i = yy * w + xx, k = known[i];
      ws += k; r += k * px[i * 3]; g += k * px[i * 3 + 1]; b += k * px[i * 3 + 2];
    }
    const j = y * w2 + x;
    k2[j] = Math.min(1, ws);
    if (ws > 0) { p2[j * 3] = r / ws; p2[j * 3 + 1] = g / ws; p2[j * 3 + 2] = b / ws; }
    if (k2[j] < 1) incompleto = true;
  }
  if (incompleto) pushPull(p2, k2, w2, h2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, k = known[i];
    if (k >= 1) continue;
    const fx = Math.min(w2 - 1, Math.max(0, (x + 0.5) / 2 - 0.5)), fy = Math.min(h2 - 1, Math.max(0, (y + 0.5) / 2 - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(w2 - 1, x0 + 1), y1 = Math.min(h2 - 1, y0 + 1);
    const ax = fx - x0, ay = fy - y0;
    for (let c = 0; c < 3; c++) {
      const v = (1 - ay) * ((1 - ax) * p2[(y0 * w2 + x0) * 3 + c] + ax * p2[(y0 * w2 + x1) * 3 + c])
              + ay * ((1 - ax) * p2[(y1 * w2 + x0) * 3 + c] + ax * p2[(y1 * w2 + x1) * 3 + c]);
      px[i * 3 + c] = k * px[i * 3 + c] + (1 - k) * v;
    }
  }
}

function laplace(px, mask, w, h, iter = 300) {
  const idx = [];
  for (let i = 0; i < w * h; i++) if (mask[i]) idx.push(i);
  for (let it = 0; it < iter; it++) for (const i of idx) {
    const x = i % w, y = (i - x) / w;
    const n = [x > 0 ? i - 1 : i, x < w - 1 ? i + 1 : i, y > 0 ? i - w : i, y < h - 1 ? i + w : i];
    for (let c = 0; c < 3; c++) px[i * 3 + c] = (px[n[0] * 3 + c] + px[n[1] * 3 + c] + px[n[2] * 3 + c] + px[n[3] * 3 + c]) / 4;
  }
}

/** Ruído gaussiano leve dentro da máscara, para o preenchimento ter o mesmo grão da foto. */
function grain(px, mask, sigma, seed = 7) {
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < mask.length; i++) if (mask[i]) {
    const n = Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd()) * sigma;
    for (let c = 0; c < 3; c++) px[i * 3 + c] += n;
  }
}

/** Desfoque de caixa separável, 3 passadas (≈ gaussiano de desvio r·0,58·√3). */
function boxBlur(src, w, h, ch, r) {
  let a = Float32Array.from(src), b = new Float32Array(src.length);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) for (let c = 0; c < ch; c++) {
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += a[(y * w + Math.min(w - 1, Math.max(0, x))) * ch + c];
      for (let x = 0; x < w; x++) {
        b[(y * w + x) * ch + c] = acc / (2 * r + 1);
        acc += a[(y * w + Math.min(w - 1, x + r + 1)) * ch + c] - a[(y * w + Math.max(0, x - r)) * ch + c];
      }
    }
    for (let x = 0; x < w; x++) for (let c = 0; c < ch; c++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += b[(Math.min(h - 1, Math.max(0, y)) * w + x) * ch + c];
      for (let y = 0; y < h; y++) {
        a[(y * w + x) * ch + c] = acc / (2 * r + 1);
        acc += b[(Math.min(h - 1, y + r + 1) * w + x) * ch + c] - b[(Math.max(0, y - r) * w + x) * ch + c];
      }
    }
  }
  return a;
}

/**
 * Preenche a máscara. Com `nc`, começa por convolução normalizada (média gaussiana larga só
 * dos pixels conhecidos), que continua fundos desfocados sem os "leques" do push-pull; depois
 * relaxa por Laplace para colar nas bordas e põe grão.
 */
function fill(img, mask, { sigma = 0.9, iter = 300, nc = 0 } = {}) {
  const { w, h, px } = img;
  const known = Float32Array.from(mask, m => (m ? 0 : 1));
  if (nc) {
    const pk = new Float32Array(w * h * 3);
    for (let i = 0; i < w * h; i++) for (let k = 0; k < 3; k++) pk[i * 3 + k] = px[i * 3 + k] * known[i];
    const bp = boxBlur(pk, w, h, 3, nc), bk = boxBlur(known, w, h, 1, nc);
    let falta = false;
    for (let i = 0; i < w * h; i++) if (mask[i]) {
      if (bk[i] > 1e-3) for (let k = 0; k < 3; k++) px[i * 3 + k] = bp[i * 3 + k] / bk[i];
      else falta = true;
    }
    if (falta) pushPull(px, Float32Array.from(mask, (m, i) => (m ? 0 : 1)), w, h);
  } else pushPull(px, known, w, h);
  laplace(px, mask, w, h, iter);
  grain(px, mask, sigma);
}

/** Ajuste de círculo por mínimos quadrados (método de Kåsa). */
function fitCircle(pts) {
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0;
  for (const [x, y] of pts) { const z = x * x + y * y; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; sxz += x * z; syz += y * z; sz += z; }
  const A = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, pts.length]], B = [sxz, syz, sz];
  const det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(A), rep = i => A.map((r, j) => r.map((v, k) => (k === i ? B[j] : v)));
  const cx = det(rep(0)) / D / 2, cy = det(rep(1)) / D / 2;
  return { cx, cy, r: Math.sqrt(det(rep(2)) / D + cx * cx + cy * cy) };
}

function sampleBilinear(px, w, h, fx, fy, c) {
  const x0 = Math.max(0, Math.min(w - 1, Math.floor(fx))), y0 = Math.max(0, Math.min(h - 1, Math.floor(fy)));
  const x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), ax = fx - x0, ay = fy - y0;
  return (1 - ay) * ((1 - ax) * px[(y0 * w + x0) * 3 + c] + ax * px[(y0 * w + x1) * 3 + c])
       + ay * ((1 - ax) * px[(y1 * w + x0) * 3 + c] + ax * px[(y1 * w + x1) * 3 + c]);
}

// ---------------------------------------------------------------- 1. recortes limpos

/**
 * Hero (ref 1): foto do Speedmaster entre o título e a faixa de marcas.
 * Por cima dela estavam o parágrafo, os dois botões e o rótulo "MARCAS QUE TRABALHAMOS".
 * O recorte vai até y=1622, logo acima dos logotipos; o CSS esmaece a parte de baixo.
 */
async function heroLimpo() {
  const R = { x: 0, y: 642, w: 887, h: 980 };            // y 642..1622 da referência
  const img = await readRegion(1, R);
  const { w, h } = img;
  const loc = (x, y) => ({ x: x - R.x, y: y - R.y });     // coordenada da referência → recorte

  const p = loc(64, 664);
  const paragrafo = dilateMask(textMask(img, { x: p.x, y: p.y, w: 492, h: 170 }, 5, 4), w, h, 2);
  const botaoPreto = rectMask(w, h, { ...loc(60, 856), w: 396, h: 100 });
  const botaoBranco = rectMask(w, h, { ...loc(58, 965), w: 364, h: 96 });
  const mask = orMask(paragrafo, botaoPreto, botaoBranco);

  // Rótulo e seu fio: ali a foto já está esmaecida e as bordas que passam por baixo (lateral
  // da caixa) são quase verticais; interpolar coluna a coluna entre a linha de cima e a de
  // baixo preserva essas bordas melhor que um preenchimento 2D.
  for (const r of [{ ...loc(52, 1571), w: 364, h: 27 }, { ...loc(52, 1553), w: 50, h: 8 }]) {
    for (let x = r.x; x < r.x + r.w; x++) {
      const media = (y0, y1) => [0, 1, 2].map(k => { let t = 0; for (let y = y0; y <= y1; y++) t += img.px[(y * w + x) * 3 + k]; return t / (y1 - y0 + 1); });
      const a = media(r.y - 3, r.y - 1), b = media(r.y + r.h, r.y + r.h + 2);
      for (let y = r.y; y < r.y + r.h; y++) {
        const f = (y - r.y + 1) / (r.h + 1);
        for (let k = 0; k < 3; k++) img.px[(y * w + x) * 3 + k] = a[k] * (1 - f) + b[k] * f;
      }
    }
    grain(img.px, rectMask(w, h, r), 0.9, 11);
  }

  // O fim do botão branco cobre um trecho da borda do bisel. Ali cada pixel é refeito ao longo
  // do seu próprio círculo (mesma distância do centro): acha-se o primeiro trecho visível de
  // cada lado do arco, tira-se o percentil 35 de 5° de cada lado (ignora traços e numerais) e
  // interpola-se pelo ângulo. Resultado: bisel liso, contínuo nas duas emendas, sem numerais
  // repetidos. O botão de vidro do site fica por cima desse trecho.
  const borda = [[417, 1010], [470, 950], [500, 932], [530, 916], [560, 900], [351, 1060], [337, 1080], [329, 1100], [318, 1120]]
    .map(([x, y]) => [x - R.x, y - R.y]);
  const c = fitCircle(borda);
  const rIn = c.r - 60, rOut = c.r + 14;
  const src = Float32Array.from(img.px), orig = Uint8Array.from(mask);
  const visivel = (d, t) => {
    const sx = c.cx + d * Math.cos(t), sy = c.cy + d * Math.sin(t);
    if (sx < 0 || sy < 0 || sx >= w - 1 || sy >= h - 1) return null;
    return orig[Math.round(sy) * w + Math.round(sx)] ? null : [sx, sy];
  };
  const passo = (0.1 * Math.PI) / 180, janela = 50;         // 50 passos de 0,1° = 5°
  let n = 0;
  for (let i = 0; i < w * h; i++) {
    if (!orig[i]) continue;
    const x = i % w, y = (i - x) / w, d = Math.hypot(x - c.cx, y - c.cy);
    if (d < rIn || d > rOut) continue;
    const t0 = Math.atan2(y - c.cy, x - c.cx);
    const lado = sgn => {
      let k = 1;
      while (k < 600 && !visivel(d, t0 + sgn * k * passo)) k++;
      if (k >= 600) return null;
      const v = [[], [], []];
      for (let j = k; j < k + janela; j++) {
        const q = visivel(d, t0 + sgn * j * passo);
        if (q) for (let ch = 0; ch < 3; ch++) v[ch].push(sampleBilinear(src, w, h, q[0], q[1], ch));
      }
      if (!v[0].length) return null;
      return { k, cor: v.map(a => a.sort((m, n) => m - n)[Math.floor(a.length * 0.35)]) };   // percentil 35: fica com o fundo do bisel, não com traços e numerais
    };
    const A = lado(-1), B = lado(1);
    if (!A || !B) continue;
    const f = A.k / (A.k + B.k);
    for (let ch = 0; ch < 3; ch++) img.px[i * 3 + ch] = A.cor[ch] * (1 - f) + B.cor[ch] * f;
    mask[i] = 0; n++;
  }
  console.log(`  hero: bisel r=${c.r.toFixed(1)} centro (${(c.cx + R.x).toFixed(1)}, ${(c.cy + R.y).toFixed(1)}), ${n} px por interpolação angular`);

  fill(img, mask, { sigma: 0.9, iter: 500, nc: 26 });
  const file = `${WORK}/hero-limpo.png`;
  await writePng(img, file);
  return file;
}

/** Recorte simples, pintando antes as caixas indicadas (ícones) com a cor do fundo. */
async function recorte(nome, ref, R, apagar = []) {
  const img = await readRegion(ref, R);
  const { w, h } = img;
  // cor do fundo: mediana dos cantos
  const cantos = [];
  for (const [x0, y0] of [[0, 0], [w - 6, 0], [0, h - 6], [w - 6, h - 6]])
    for (let y = y0; y < y0 + 6; y++) for (let x = x0; x < x0 + 6; x++) cantos.push([img.px[(y * w + x) * 3], img.px[(y * w + x) * 3 + 1], img.px[(y * w + x) * 3 + 2]]);
  const med = k => cantos.map(c => c[k]).sort((a, b) => a - b)[cantos.length >> 1];
  const bg = [med(0), med(1), med(2)];
  for (const a of apagar) {
    const m = rectMask(w, h, { x: a.x - R.x, y: a.y - R.y, w: a.w, h: a.h });
    for (let i = 0; i < w * h; i++) if (m[i]) for (let k = 0; k < 3; k++) img.px[i * 3 + k] = bg[k];
  }
  const file = `${WORK}/${nome}.png`;
  await writePng(img, file);
  return { file, bg };
}

/** Foto do relojoeiro (ref 4): cantos arredondados preenchidos, para o CSS usar qualquer raio. */
async function relojoeiro() {
  const R = { x: 108, y: 437, w: 727, h: 414 };
  const img = await readRegion(4, R);
  const { w, h } = img;
  const mask = new Uint8Array(w * h);
  const rad = 22;                                              // raio na referência + margem
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const cx = x < rad ? rad : x > w - 1 - rad ? w - 1 - rad : x;
    const cy = y < rad ? rad : y > h - 1 - rad ? h - 1 - rad : y;
    if (Math.hypot(x - cx, y - cy) > rad - 5 || lum(img.px, y * w + x) > 246 && (x < 3 || y < 3 || x > w - 4 || y > h - 4)) mask[y * w + x] = 1;
  }
  fill(img, mask, { sigma: 1.2, iter: 120 });
  const file = `${WORK}/relojoeiro.png`;
  await writePng(img, file);
  return file;
}

// ---------------------------------------------------------------- 2. ampliação 4×

function upscale(file) {
  const out = file.replace(/\.png$/, '-x4.png');
  if (!FORCE && fs.existsSync(out) && fs.statSync(out).mtimeMs > fs.statSync(file).mtimeMs) return out;
  execFileSync(ESRGAN, ['-i', file, '-o', out, '-n', 'realesrgan-x4plus', '-m', path.join(path.dirname(ESRGAN), 'models')], { stdio: 'pipe' });
  console.log('  ampliada 4×:', out);
  return out;
}

// ---------------------------------------------------------------- 3. fundo branco

/**
 * Divide cada canal pela cor do fundo: o fundo vira 255 e, com multiply no CSS, o resultado
 * sobre um fundo da mesma cor reproduz exatamente a referência. Um joelho suave leva a 255 o
 * que está a menos de ~1,5% do fundo (ruído), sem degrau.
 */
async function fundoBranco(file, bg) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 3) {
    let v = [0, 1, 2].map(k => data[i + k] / bg[k]);
    const m = Math.min(...v);
    const knee = m > 0.97 ? Math.min(1, (m - 0.97) / 0.015) : 0;         // 0,97→0,985: rampa até branco
    for (let k = 0; k < 3; k++) out[i + k] = Math.round(Math.min(1, v[k] + (1 - v[k]) * knee) * 255);
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } });
}

/** Caixa do conteúdo (tudo que não é branco) numa imagem de fundo branco. */
async function contentBox(pipeline, limiar = 250) {
  const { data, info } = await pipeline.clone().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = 0, y1 = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 3;
    if (Math.min(data[i], data[i + 1], data[i + 2]) < limiar) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * Caixa do corpo do relógio: linhas e colunas com pelo menos `min` pixels mais escuros que
 * `limiar`. A sombra suave nunca chega a tantos pixels escuros numa linha, então fica de fora.
 */
async function corpoBox(pipeline, limiar = 170, min = 10) {
  const { data, info } = await pipeline.clone().greyscale().raw().toBuffer({ resolveWithObject: true });
  const linhas = new Uint32Array(info.height), colunas = new Uint32Array(info.width);
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[y * info.width + x] < limiar) { linhas[y]++; colunas[x]++; }
  }
  const primeiro = a => a.findIndex(v => v >= min), ultimo = a => a.length - 1 - [...a].reverse().findIndex(v => v >= min);
  const y0 = primeiro(linhas), y1 = ultimo(linhas), x0 = primeiro(colunas), x1 = ultimo(colunas);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// ---------------------------------------------------------------- 4. exportação

async function exportar(pipeline, nome, larguras, { avif = 58, webp = 82 } = {}) {
  const meta = await pipeline.clone().png().toBuffer({ resolveWithObject: true });
  const out = [];
  for (const lw of larguras) {
    const base = pipeline.clone().resize({ width: lw, kernel: 'lanczos3' });
    const a = `${OUT}/${nome}-${lw}.avif`, wb = `${OUT}/${nome}-${lw}.webp`;
    await base.clone().avif({ quality: avif, effort: 9, chromaSubsampling: '4:4:4' }).toFile(a);
    await base.clone().webp({ quality: webp, effort: 6, smartSubsample: true }).toFile(wb);
    out.push([lw, fs.statSync(a).size, fs.statSync(wb).size]);
  }
  const ratio = meta.info.height / meta.info.width;
  console.log(`  ${nome}: ${meta.info.width}×${meta.info.height} (h/w ${ratio.toFixed(4)}) → ` + out.map(([lw, a, wb]) => `${lw}px avif ${(a / 1024).toFixed(0)}K webp ${(wb / 1024).toFixed(0)}K`).join(' | '));
  return ratio;
}

/**
 * Relógio: fundo branco e tela padrão 2:3. O enquadramento é pelo CORPO do relógio (pixels
 * bem escuros, sem a sombra suave): o corpo ocupa 84% da altura, com o topo a 8%. A sombra
 * fica livre nos 8% de baixo. Assim todos os relógios aparecem do mesmo tamanho nos cards,
 * tenham sombra longa ou curta.
 */
async function relogio(nome, ref, R, apagar = []) {
  const { file, bg } = await recorte(nome, ref, R, apagar);
  const x4 = upscale(file);
  const pipe = await fundoBranco(x4, bg);
  const tudo = await contentBox(pipe, 250);       // inclui a sombra
  const corpo = await corpoBox(pipe);             // só o relógio (sem a sombra)
  const W = 1200, H = 1800, alturaCorpo = 0.84 * H, topoCorpo = 0.08 * H;
  const k = Math.min(alturaCorpo / corpo.h, (W * 0.96) / corpo.w);
  const img = await pipe.clone().png().toBuffer();
  const meta = await sharp(img).metadata();
  const rw = Math.round(meta.width * k), rh = Math.round(meta.height * k);
  const escalada = await sharp(img).resize({ width: rw, height: rh, kernel: 'lanczos3' }).png().toBuffer();
  // posição da imagem escalada para o corpo cair no lugar certo
  const cx = (corpo.x + corpo.w / 2) * k, top = topoCorpo + ((alturaCorpo - corpo.h * k) / 2) - corpo.y * k;
  const left = Math.round(W / 2 - cx);
  // recorta o que sair da tela (só fundo branco ou o fim da sombra)
  const ex = { left: Math.max(0, -left), top: Math.max(0, -Math.round(top)) };
  ex.width = Math.min(rw - ex.left, W - Math.max(0, left));
  ex.height = Math.min(rh - ex.top, H - Math.max(0, Math.round(top)));
  const parte = await sharp(escalada).extract(ex).png().toBuffer();
  const master = sharp(await sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } })
    .composite([{ input: parte, left: Math.max(0, left), top: Math.max(0, Math.round(top)) }]).png().toBuffer());
  const sombra = ((tudo.y + tudo.h) - (corpo.y + corpo.h)) * k;
  console.log(`  ${nome}: corpo ${corpo.w}×${corpo.h}px na ampliação; sombra abaixo do corpo = ${(sombra / H * 100).toFixed(1)}% da altura`);
  await exportar(master, nome, [400, 600, 800, 1200]);
}

// ---------------------------------------------------------------- execução

if (etapa('hero')) {
  console.log('Hero');
  const x4 = upscale(await heroLimpo());
  await exportar(sharp(x4), 'hero-speedmaster', [800, 1200, 1600], { avif: 60, webp: 84 });
}

if (etapa('relogios')) {
console.log('Relógios');
await relogio('omega-seamaster-diver-300m', 3, { x: 250, y: 110, w: 480, h: 665 }, [{ x: 670, y: 98, w: 60, h: 56 }]);
await relogio('orient-bambino', 2, { x: 470, y: 672, w: 300, h: 364 }, [{ x: 726, y: 672, w: 44, h: 48 }]);
await relogio('casio-g-shock-ga-2100', 5, { x: 140, y: 480, w: 580, h: 815 });
await relogio('seiko-presage', 2, { x: 470, y: 1180, w: 300, h: 372 }, [{ x: 726, y: 1186, w: 44, h: 48 }]);
}

if (etapa('relojoeiro')) {
  console.log('Relojoeiro');
  const x4 = upscale(await relojoeiro());
  await exportar(sharp(x4), 'assistencia-relojoeiro', [600, 900, 1200, 1600]);
}

if (etapa('pedras')) {
  console.log('Pedras');
  // o parágrafo e o botão "Ver coleção" da referência ficam sobre o céu branco, acima das pedras
  const { file, bg } = await recorte('pedras', 5, { x: 0, y: 1296, w: 853, h: 404 },
    [{ x: 40, y: 1296, w: 460, h: 128 }, { x: 40, y: 1424, w: 368, h: 112 }]);
  const x4 = upscale(file);
  const pipe = await fundoBranco(x4, bg);
  await exportar(sharp(await pipe.png().toBuffer()), 'destaque-pedras', [800, 1200, 1600]);
}
