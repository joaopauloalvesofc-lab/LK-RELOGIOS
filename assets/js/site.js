// LK Relógios — comportamento do site (sem dependências).
// Estado do visitante (carrinho e favoritos) fica no localStorage deste navegador; tudo
// continua funcionando se o armazenamento estiver bloqueado (aba anônima, por exemplo).

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const dados = JSON.parse($('#dados')?.textContent || '{"produtos":[],"loja":{}}');
const porSlug = Object.fromEntries(dados.produtos.map(p => [p.slug, p]));
const brl = n => 'R$ ' + n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const semAcento = s => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

// ------------------------------------------------------------------ armazenamento seguro
const guardado = {
  ler(chave, padrao) { try { const v = localStorage.getItem(chave); return v ? JSON.parse(v) : padrao; } catch { return padrao; } },
  gravar(chave, valor) { try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* sem armazenamento: segue só nesta visita */ } },
};
let carrinho = guardado.ler('lk:carrinho', []).filter(i => porSlug[i.slug] && i.qtd > 0);
let favoritos = new Set(guardado.ler('lk:favoritos', []).filter(s => porSlug[s]));

// ------------------------------------------------------------------ aviso (toast)
const toast = $('[data-toast]');
let toastT;
function avisar(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('visivel');
  clearTimeout(toastT);
  toastT = setTimeout(() => toast.classList.remove('visivel'), 2200);
}

// ------------------------------------------------------------------ cabeçalho
const topo = $('[data-topo]');
if (topo) {
  let ultimo = scrollY, pedido = false;
  const atualizar = () => {
    pedido = false;
    const y = Math.max(0, scrollY);
    topo.classList.toggle('rolado', y > 8);
    // some ao descer, volta ao subir (só na home; na página do produto os ícones ficam fixos)
    if (!topo.classList.contains('produto-topo')) {
      if (y > ultimo + 6 && y > 140) topo.classList.add('oculto');
      else if (y < ultimo - 6 || y < 140) topo.classList.remove('oculto');
    }
    ultimo = y;
  };
  addEventListener('scroll', () => { if (!pedido) { pedido = true; requestAnimationFrame(atualizar); } }, { passive: true });
  atualizar();
  // links internos: mostrar o cabeçalho de novo não pode cobrir o destino
  topo.addEventListener('focusin', () => topo.classList.remove('oculto'));
}

// ------------------------------------------------------------------ diálogos
let abertoPor = null;
function abrir(id, origem) {
  const d = document.getElementById(id);
  if (!d || d.open) return;
  $$('dialog[open]').forEach(o => o.close());
  abertoPor = origem || document.activeElement;
  if (id === 'carrinho') renderCarrinho();
  if (id === 'busca') renderBusca('');
  d.showModal();
  document.documentElement.classList.add('trava');
  if (id === 'menu') ajustarMenu();
  if (id === 'busca') { const q = $('[data-busca-q]', d); q.value = ''; q.focus(); }
}
const reduzMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Faz o menu caber inteiro na altura da tela, sem rolagem. As medidas compressíveis do CSS
 * dependem de --k (1 = desenho completo, 0 = mais compacto). Mede a altura natural nos dois
 * extremos e interpola o --k que preenche exatamente a altura disponível. Se nem o compacto
 * couber (telas muito baixas), tira as legendas dos itens; só então sobra rolagem.
 */
function ajustarMenu() {
  const d = document.getElementById('menu');
  if (!d?.open) return;
  const m = $('.menu', d);
  const altura = k => { d.style.setProperty('--k', k); return m.offsetHeight; };
  d.classList.remove('compacto');
  m.style.minHeight = '0';
  const disponivel = d.clientHeight;
  let h1 = altura(1), h0 = altura(0);
  if (disponivel < h0) { d.classList.add('compacto'); h1 = altura(1); h0 = altura(0); }
  const k = h1 > h0 ? Math.min(1, Math.max(0, (disponivel - h0) / (h1 - h0))) : 1;
  d.style.setProperty('--k', k.toFixed(3));
  m.style.minHeight = '';
}
let ajusteT;
const reajustar = () => { clearTimeout(ajusteT); ajusteT = setTimeout(ajustarMenu, 60); };
addEventListener('resize', reajustar);
window.visualViewport?.addEventListener('resize', reajustar);
/** Fecha o diálogo; o menu sai com animação antes. `depois` roda quando já está fechado. */
function fechar(d, depois) {
  if (!d?.open || d.classList.contains('fechando')) return;
  if (d.classList.contains('dlg-menu') && !reduzMovimento()) {
    d.classList.add('fechando');
    setTimeout(() => { d.classList.remove('fechando'); d.close(); depois?.(); }, 230);
  } else { d.close(); depois?.(); }
}
$$('dialog').forEach(d => {
  d.addEventListener('close', () => {
    document.documentElement.classList.remove('trava');
    if (abertoPor && document.contains(abertoPor)) abertoPor.focus({ preventScroll: true });
  });
  // Esc no menu: fecha com a mesma animação do botão
  d.addEventListener('cancel', e => { if (d.classList.contains('dlg-menu')) { e.preventDefault(); fechar(d); } });
  // toque fora do conteúdo (no fundo escurecido) fecha a folha do carrinho
  d.addEventListener('click', e => { if (e.target === d && d.classList.contains('dlg-carrinho')) d.close(); });
});
document.addEventListener('click', e => {
  const a = e.target.closest('[data-abrir]');
  if (a) { e.preventDefault(); abrir(a.dataset.abrir, a); return; }
  const f = e.target.closest('[data-fechar]');
  if (f) {
    const d = f.closest('dialog');
    // Links: âncora desta mesma página → fecha primeiro (libera a rolagem) e depois rola até a
    // seção; outra página → o navegador segue normalmente.
    if (f.tagName === 'A') {
      const url = new URL(f.href, location.href);
      abertoPor = null;
      if (url.pathname === location.pathname && url.hash) {
        e.preventDefault();
        fechar(d, () => {
          const alvo = document.getElementById(decodeURIComponent(url.hash.slice(1)));
          if (!alvo) return;
          history.pushState(null, '', url.hash);
          alvo.scrollIntoView({ behavior: reduzMovimento() ? 'auto' : 'smooth', block: 'start' });
        });
      } else fechar(d);
      return;
    }
    e.preventDefault(); fechar(d);
  }
});

// ------------------------------------------------------------------ favoritos
function pintarFavoritos() {
  $$('[data-fav]').forEach(b => b.setAttribute('aria-pressed', favoritos.has(b.dataset.fav) ? 'true' : 'false'));
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-fav]');
  if (!b) return;
  e.preventDefault();
  const s = b.dataset.fav;
  const liga = !favoritos.has(s);
  liga ? favoritos.add(s) : favoritos.delete(s);
  guardado.gravar('lk:favoritos', [...favoritos]);
  pintarFavoritos();
  b.classList.remove('bate'); void b.offsetWidth; b.classList.add('bate');
  const p = porSlug[s];
  avisar(liga ? `${p.marca} ${p.modelo} nos favoritos` : 'Removido dos favoritos');
});
pintarFavoritos();

// ------------------------------------------------------------------ carrinho
const qtdTotal = () => carrinho.reduce((n, i) => n + i.qtd, 0);
function salvarCarrinho() { guardado.gravar('lk:carrinho', carrinho); pintarSelo(); }
function pintarSelo(pulsar = false) {
  const n = qtdTotal();
  $$('[data-carrinho-qtd]').forEach(s => {
    s.textContent = n > 99 ? '99+' : String(n);
    if (pulsar) { s.classList.remove('pulsa'); void s.offsetWidth; s.classList.add('pulsa'); }
  });
  $$('[data-carrinho-btn]').forEach(b => b.setAttribute('aria-label', n ? `Carrinho, ${n} ${n === 1 ? 'item' : 'itens'}` : 'Carrinho vazio'));
}
function adicionar(slug) {
  const i = carrinho.find(x => x.slug === slug);
  i ? i.qtd++ : carrinho.push({ slug, qtd: 1 });
  salvarCarrinho(); pintarSelo(true);
}
function mudarQtd(slug, delta) {
  const i = carrinho.find(x => x.slug === slug);
  if (!i) return;
  i.qtd += delta;
  if (i.qtd <= 0) carrinho = carrinho.filter(x => x.slug !== slug);
  salvarCarrinho(); renderCarrinho();
}
function picture(p, cls) {
  return `<picture class="${cls}"><source type="image/avif" srcset="${p.img}.avif"><img src="${p.img}.webp" alt="" width="400" height="600" loading="lazy" decoding="async"></picture>`;
}
function linkWhatsApp() {
  const linhas = carrinho.map(i => { const p = porSlug[i.slug]; return `• ${i.qtd}× ${p.marca} ${p.nome} — ${brl(p.preco * i.qtd)}`; });
  const total = carrinho.reduce((n, i) => n + porSlug[i.slug].preco * i.qtd, 0);
  const txt = `Olá, ${dados.loja.nome}! Quero finalizar este pedido:\n\n${linhas.join('\n')}\n\nTotal: ${brl(total)}`;
  const q = 'text=' + encodeURIComponent(txt);
  return dados.loja.whatsapp ? `https://wa.me/${dados.loja.whatsapp}?${q}` : `https://wa.me/?${q}`;
}
function renderCarrinho() {
  const lista = $('[data-carrinho-lista]'), pe = $('[data-carrinho-pe]');
  if (!lista) return;
  if (!carrinho.length) {
    const base = document.documentElement.dataset.base || '';
    lista.innerHTML = `<div class="vazio-carrinho"><p>Seu carrinho está vazio.</p><a class="btn btn-escuro" href="${base}#relogios" data-fechar>Ver relógios</a></div>`;
    pe.hidden = true;
    return;
  }
  lista.innerHTML = `<ul class="item-lista">${carrinho.map(i => {
    const p = porSlug[i.slug];
    return `<li class="item item-carrinho">
      <a href="${p.url}" tabindex="-1" aria-hidden="true">${picture(p, 'item-foto')}</a>
      <div class="item-txt"><b>${esc(p.marca)}</b><span>${esc(p.nome)}</span>
        <div class="qtd" role="group" aria-label="Quantidade de ${esc(p.marca + ' ' + p.nome)}">
          <button type="button" data-qtd="-1" data-slug="${p.slug}" aria-label="${i.qtd === 1 ? 'Remover' : 'Diminuir'}">${i.qtd === 1 ? ICONE_LIXO : ICONE_MENOS}</button>
          <output aria-live="polite">${i.qtd}</output>
          <button type="button" data-qtd="1" data-slug="${p.slug}" aria-label="Aumentar">${ICONE_MAIS}</button>
        </div>
      </div>
      <span class="item-preco">${brl(p.preco * i.qtd)}</span>
    </li>`;
  }).join('')}</ul>`;
  $('[data-carrinho-total]').textContent = brl(carrinho.reduce((n, i) => n + porSlug[i.slug].preco * i.qtd, 0));
  $('[data-carrinho-finalizar]').href = linkWhatsApp();
  pe.hidden = false;
}
const svgIco = d => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONE_MAIS = svgIco('<path d="M12 5.5v13M5.5 12h13"/>');
const ICONE_MENOS = svgIco('<path d="M5.5 12h13"/>');
const ICONE_LIXO = svgIco('<path d="M4.5 6.5h15M9.5 6.5V4.8c0-.5.4-.8.8-.8h3.4c.5 0 .8.3.8.8v1.7M6.5 6.5l.8 12.6c0 .5.5.9 1 .9h7.4c.5 0 1-.4 1-.9l.8-12.6"/>');

document.addEventListener('click', e => {
  const add = e.target.closest('[data-adicionar]');
  if (add) {
    adicionar(add.dataset.adicionar);
    add.textContent = 'Adicionado ✓';
    setTimeout(() => { add.textContent = 'Adicionar ao carrinho'; }, 1600);
    setTimeout(() => abrir('carrinho', add), 280);
    return;
  }
  const q = e.target.closest('[data-qtd]');
  if (q) {
    const slug = q.dataset.slug, delta = +q.dataset.qtd;
    mudarQtd(slug, delta);
    // mantém o foco num controle que ainda existe
    const alvo = $(`[data-slug="${slug}"][data-qtd="${delta}"]`) || $(`[data-slug="${slug}"]`) || $('#carrinho .icone-btn');
    alvo?.focus();
  }
});
pintarSelo();
addEventListener('storage', e => {
  if (e.key === 'lk:carrinho') { carrinho = guardado.ler('lk:carrinho', []); pintarSelo(); }
  if (e.key === 'lk:favoritos') { favoritos = new Set(guardado.ler('lk:favoritos', [])); pintarFavoritos(); }
});

// ------------------------------------------------------------------ catálogo: filtros
const grade = $('[data-grade]');
let filtroGenero = 'todos', filtroMarca = '';
function aplicarFiltros() {
  if (!grade) return;
  let visiveis = 0;
  $$('.card', grade).forEach(c => {
    const g = c.dataset.genero.split(' ');
    const m = c.dataset.marca;
    const okG = filtroGenero === 'todos' || g.includes(filtroGenero);
    const okM = !filtroMarca || m === filtroMarca || (filtroMarca === 'Casio' && m === 'G-Shock');
    c.hidden = !(okG && okM);
    if (!c.hidden) visiveis++;
  });
  $('[data-vazio]').hidden = visiveis > 0;
  const fm = $('[data-filtro-marca]');
  fm.hidden = !filtroMarca;
  $('[data-filtro-marca-nome]').textContent = filtroMarca;
}
$$('.chip[data-filtro]').forEach(ch => ch.addEventListener('click', () => {
  filtroGenero = ch.dataset.filtro;
  $$('.chip[data-filtro]').forEach(o => o.setAttribute('aria-pressed', o === ch ? 'true' : 'false'));
  aplicarFiltros();
}));
$('[data-limpar-marca]')?.addEventListener('click', () => { filtroMarca = ''; aplicarFiltros(); });
document.addEventListener('click', e => {
  const m = e.target.closest('[data-marca]:not(.card)');
  if (!m || !grade) return;
  filtroMarca = m.dataset.marca;
  filtroGenero = 'todos';
  $$('.chip[data-filtro]').forEach(o => o.setAttribute('aria-pressed', o.dataset.filtro === 'todos' ? 'true' : 'false'));
  aplicarFiltros();
  // o link segue para #relogios normalmente
});

// ------------------------------------------------------------------ busca
function renderBusca(q) {
  const box = $('[data-busca-res]');
  if (!box) return;
  const termo = semAcento(q.trim());
  const item = p => `<li><a class="item" href="${p.url}">${picture(p, 'item-foto')}<span class="item-txt"><b>${esc(p.marca)}</b><span>${esc(p.nome)}</span></span><span class="item-preco">${brl(p.preco)}</span></a></li>`;
  if (!termo) {
    const favs = [...favoritos].map(s => porSlug[s]).filter(Boolean);
    const marcas = [...new Set(dados.produtos.map(p => p.marca))];
    box.innerHTML = `<h2>Marcas</h2><div class="busca-marcas">${marcas.map(m => `<button type="button" data-busca-marca="${esc(m)}">${esc(m)}</button>`).join('')}</div>`
      + (favs.length ? `<h2>Seus favoritos</h2><ul class="item-lista">${favs.map(item).join('')}</ul>` : `<h2>Todos os relógios</h2><ul class="item-lista">${dados.produtos.map(item).join('')}</ul>`);
    return;
  }
  const achados = dados.produtos.filter(p => semAcento(`${p.marca} ${p.nome} ${p.modelo} ${p.marca === 'G-Shock' ? 'casio' : ''}`).includes(termo));
  box.innerHTML = achados.length
    ? `<h2>${achados.length} ${achados.length === 1 ? 'resultado' : 'resultados'}</h2><ul class="item-lista">${achados.map(item).join('')}</ul>`
    : `<p class="dica">Nada encontrado para “${esc(q.trim())}”. Tente uma marca, como Omega ou Seiko.</p>`;
}
const campoBusca = $('[data-busca-q]');
campoBusca?.addEventListener('input', () => renderBusca(campoBusca.value));
// Esc fecha a busca na hora (o padrão do campo de busca seria só limpar o texto)
campoBusca?.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); fechar(campoBusca.closest('dialog')); } });
$('[data-busca-form]')?.addEventListener('submit', e => {
  e.preventDefault();
  $('[data-busca-res] a.item')?.click();
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-busca-marca]');
  if (!b) return;
  campoBusca.value = b.dataset.buscaMarca;
  renderBusca(campoBusca.value);
  campoBusca.focus();
});

// ------------------------------------------------------------------ produto: compartilhar, voltar, galeria
$('[data-compartilhar]')?.addEventListener('click', async () => {
  const dadosShare = { title: document.title, text: $('meta[name="description"]')?.content, url: location.href };
  if (navigator.share) {
    try { await navigator.share(dadosShare); } catch { /* cancelado */ }
    return;
  }
  try { await navigator.clipboard.writeText(location.href); avisar('Link copiado'); }
  catch { avisar('Copie o endereço na barra do navegador'); }
});
$('[data-voltar]')?.addEventListener('click', e => {
  // veio da home deste site: volta no histórico e preserva a posição de rolagem
  if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) {
    e.preventDefault(); history.back();
  }
});
const trilho = $('[data-galeria]');
const pontos = $$('.galeria-pontos span');
if (trilho && pontos.length) {
  trilho.addEventListener('scroll', () => {
    const i = Math.round(trilho.scrollLeft / trilho.clientWidth);
    pontos.forEach((p, k) => p.classList.toggle('ativo', k === i));
  }, { passive: true });
}
