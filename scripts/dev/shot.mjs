// Captura de tela com Chrome do sistema e emulação de celular. Registra erros do console.
// uso: node scripts/dev/shot.mjs <url> <saida.png> [largura=393] [altura=852] [dpr=2] [fullPage=0]
import puppeteer from 'puppeteer-core';
const [,, url, out, w = '393', h = '852', dpr = '2', full = '0'] = process.argv;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const page = await browser.newPage();
const erros = [];
page.on('console', m => { if (['error', 'warning'].includes(m.type())) erros.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', e => erros.push('pageerror: ' + e.message));
page.on('requestfailed', r => erros.push('requestfailed: ' + r.url()));
await page.setViewport({ width: +w, height: +h, deviceScaleFactor: +dpr, isMobile: true, hasTouch: true });
await page.goto(url, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
if (full === '1') {
  // força o carregamento das imagens preguiçosas antes da captura inteira
  await page.evaluate(async () => { document.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager'; }); await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
}
await new Promise(r => setTimeout(r, 500));
await page.screenshot({ path: out, fullPage: full === '1' });
await browser.close();
console.log('ok', out, erros.length ? '\n' + erros.join('\n') : '(sem erros no console)');
