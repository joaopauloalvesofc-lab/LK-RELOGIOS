// Ícones de traço (grade 24×24), desenhados no mesmo peso das referências.
// Uso: icon('busca') → <svg> inline com currentColor; aria-hidden (o rótulo fica no botão).
// Contorno ondulado da engrenagem: 8 arcos entre pontos no raio 7,1 (como na referência).
const ENGRENAGEM = (() => {
  const r = 7.1, n = 8, pts = [];
  for (let i = 0; i < n; i++) { const t = (Math.PI * 2 * i) / n + Math.PI / 8; pts.push([12 + r * Math.cos(t), 12 + r * Math.sin(t)]); }
  const f = v => v.toFixed(2);
  return `<path d="M${f(pts[0][0])} ${f(pts[0][1])}${pts.map((_, i) => { const q = pts[(i + 1) % n]; return `A3.05 3.05 0 0 1 ${f(q[0])} ${f(q[1])}`; }).join('')}Z"/>`;
})();

const P = {
  busca: '<circle cx="10.6" cy="10.6" r="6.6"/><path d="m15.5 15.5 5 5"/>',
  carrinho: '<path d="M2.6 4h2.2c.5 0 .9.3 1 .8l2 10.2c.1.5.5.8 1 .8h8.8c.5 0 .9-.3 1-.8l1.6-7.2H6.3"/><circle cx="9.6" cy="19.6" r="1.25" fill="currentColor" stroke="none"/><circle cx="16.8" cy="19.6" r="1.25" fill="currentColor" stroke="none"/>',
  menu: '<path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17"/>',
  fechar: '<path d="m6 6 12 12M18 6 6 18"/>',
  seta: '<path d="M4.5 12h14.5M13.5 6.5 19 12l-5.5 5.5"/>',
  voltar: '<path d="M15 4.5 7.5 12l7.5 7.5"/>',
  coracao: '<path d="M12 20.2S3.6 15.3 3.6 9.2c0-2.7 2.1-4.7 4.6-4.7 1.6 0 3 .8 3.8 2.2.8-1.4 2.2-2.2 3.8-2.2 2.5 0 4.6 2 4.6 4.7 0 6.1-8.4 11-8.4 11z"/>',
  compartilhar: '<path d="M8.5 9.5H7a1.5 1.5 0 0 0-1.5 1.5v8.5A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V11A1.5 1.5 0 0 0 17 9.5h-1.5M12 14.5V3M8.5 6.3 12 2.8l3.5 3.5"/>',
  escudo: '<path d="M12 2.9 19 5.6v5.6c0 4.4-2.9 8.3-7 9.9-4.1-1.6-7-5.5-7-9.9V5.6l7-2.7z"/><path d="m8.7 12 2.3 2.3 4.4-4.6"/>',
  medalha: '<circle cx="12" cy="9.4" r="6.1"/><path d="m8.7 14.5-1.5 6.7 4.8-2.6 4.8 2.6-1.5-6.7"/><path d="m12 6.6.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z" stroke-width="1.2"/>',
  caixa: '<path d="m12 2.8 8.2 4.5v9.4L12 21.2l-8.2-4.5V7.3L12 2.8z"/><path d="m3.8 7.3 8.2 4.5 8.2-4.5M12 11.8v9.4M7.9 5l8.2 4.6"/>',
  mais: '<path d="M12 5.5v13M5.5 12h13"/>',
  menos: '<path d="M5.5 12h13"/>',
  lixeira: '<path d="M4.5 6.5h15M9.5 6.5V4.8c0-.5.4-.8.8-.8h3.4c.5 0 .8.3.8.8v1.7M6.5 6.5l.8 12.6c0 .5.5.9 1 .9h7.4c.5 0 1-.4 1-.9l.8-12.6"/>',
  // serviços (tela 4): traço grosso e o losango central que se repete nos ícones da referência
  revisao: '<circle cx="12" cy="13" r="7"/><path d="M12 6V3.8M10.6 3.6h2.8M6.9 18.1l-1.2 1.5M17.1 18.1l1.2 1.5"/><path d="m12 11.3 1.5 1.7-1.5 1.7-1.5-1.7z" fill="currentColor" stroke-width="1"/>',
  bateria: '<rect x="6.3" y="6.2" width="11.4" height="13.8" rx="2.8"/><path d="M9.9 6.2V4.9c0-.6.5-1 1-1h2.2c.6 0 1 .4 1 1v1.3"/><path d="m12 11.4 1.5 1.7-1.5 1.7-1.5-1.7z" fill="currentColor" stroke-width="1"/>',
  polimento: '<rect x="10.4" y="3.6" width="3.2" height="17.6" rx="1.6" transform="rotate(-38 12 12.4)"/><rect x="10.4" y="3.6" width="3.2" height="17.6" rx="1.6" transform="rotate(38 12 12.4)" style="fill:var(--fundo-icone,#f1f1f1)"/><path d="M16.2 1.9v3.4M14.5 3.6h3.4" stroke-width="1.3"/>',
  pecas: ENGRENAGEM + '<circle cx="12" cy="12" r="2.9"/>',
  gota: '<path d="M12 3.4c-3.1 4-5.8 7.2-5.8 10.4a5.8 5.8 0 0 0 11.6 0c0-3.2-2.7-6.4-5.8-10.4z"/><path d="m12 12.4 1.4 1.6-1.4 1.6-1.4-1.6z" fill="currentColor" stroke-width="1"/>',
  // redes
  instagram: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.2"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.3" cy="6.7" r="1.05" fill="currentColor" stroke="none"/>',
  whatsapp: '<path d="M12 3.3a8.7 8.7 0 0 0-7.5 13.1L3.3 20.7l4.4-1.2A8.7 8.7 0 1 0 12 3.3z"/><path fill="currentColor" stroke="none" d="M9.2 7.7c-.3 0-.6.1-.9.4-.4.5-.9 1.3-.6 2.6.5 1.9 2.6 4.3 4.7 5.2 1.5.7 2.4.6 3 .2.5-.3.8-.8.9-1.2.1-.3 0-.6-.3-.7l-1.7-.8c-.3-.1-.5-.1-.7.1l-.6.8c-.2.2-.4.2-.7.1-1-.5-1.9-1.3-2.4-2.3-.1-.2-.1-.5.1-.6l.5-.6c.2-.2.2-.4.1-.7l-.7-1.8c-.1-.4-.4-.5-.7-.5z"/>',
};

export function icon(nome, cls = '') {
  const p = P[nome];
  if (!p) throw new Error(`ícone desconhecido: ${nome}`);
  return `<svg class="ico${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${p}</svg>`;
}
