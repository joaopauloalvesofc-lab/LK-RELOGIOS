// Monta dist/ só com o que vai ao ar (páginas e assets), para hospedagens que publicam uma pasta
// de saída (Vercel). Rodar depois de `npm run build`. Uso: node scripts/dist.mjs
import fs from 'node:fs';

const SAIDA = 'dist';
const ITENS = ['index.html', 'relogio', 'assets'];

fs.rmSync(SAIDA, { recursive: true, force: true });
fs.mkdirSync(SAIDA);
for (const item of ITENS) {
  if (!fs.existsSync(item)) throw new Error(`falta ${item}: rode npm run build antes`);
  fs.cpSync(item, `${SAIDA}/${item}`, { recursive: true });
}
const tamanho = dir => fs.readdirSync(dir, { withFileTypes: true })
  .reduce((t, e) => t + (e.isDirectory() ? tamanho(`${dir}/${e.name}`) : fs.statSync(`${dir}/${e.name}`).size), 0);
const arquivos = dir => fs.readdirSync(dir, { withFileTypes: true })
  .reduce((n, e) => n + (e.isDirectory() ? arquivos(`${dir}/${e.name}`) : 1), 0);
console.log(`${SAIDA}/: ${arquivos(SAIDA)} arquivos, ${(tamanho(SAIDA) / 1024 / 1024).toFixed(2)} MB`);
