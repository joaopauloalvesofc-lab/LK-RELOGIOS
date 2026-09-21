// Gera as páginas estáticas a partir de data/*.json e src/svg/*.svg:
//   index.html                      home (hero, catálogo, destaque, serviços, sobre, rodapé)
//   relogio/<slug>/index.html       uma página por relógio
// Não edite os .html gerados: edite este arquivo, os dados ou os SVGs e rode `npm run build`.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { icon } from '../src/icons.mjs';

const loja = JSON.parse(fs.readFileSync('data/loja.json', 'utf8'));
const produtos = JSON.parse(fs.readFileSync('data/produtos.json', 'utf8'));
const svg = nome => fs.readFileSync(`src/svg/${nome}.svg`, 'utf8').trim();
// Versão de CSS/JS para quebrar cache: hash do conteúdo (só muda quando os arquivos mudam).
const V = createHash('sha256').update(fs.readFileSync('assets/css/site.css')).update(fs.readFileSync('assets/js/site.js')).digest('hex').slice(0, 10);

// ------------------------------------------------------------------ utilidades
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const brl = n => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const brlCent = n => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parcela = p => brlCent(Math.round((p.preco / p.parcelas) * 100) / 100);

const wa = texto => {
  const q = 'text=' + encodeURIComponent(texto);
  return loja.whatsapp ? `https://wa.me/${loja.whatsapp}?${q}` : `https://wa.me/?${q}`;
};
const instagram = loja.instagram ? `https://www.instagram.com/${loja.instagram}/` : 'https://www.instagram.com/';

/** <picture> com AVIF e WebP. `larguras` são as exportadas por build-images. */
function picture(nome, { larguras, sizes, alt = '', w, h, cls = '', lazy = true, prioridade = false, base }) {
  const set = ext => larguras.map(l => `${base}assets/img/${nome}-${l}.${ext} ${l}w`).join(', ');
  const media = larguras[Math.min(1, larguras.length - 1)];
  return `<picture class="${cls}">`
    + `<source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">`
    + `<img src="${base}assets/img/${nome}-${media}.webp" srcset="${set('webp')}" sizes="${sizes}" width="${w}" height="${h}" alt="${esc(alt)}"`
    + (lazy ? ' loading="lazy"' : '') + ' decoding="async"' + (prioridade ? ' fetchpriority="high"' : '') + '>'
    + `</picture>`;
}
const RELOGIO = { larguras: [400, 600, 800, 1200], w: 1200, h: 1800 };

const marcasHero = [
  ['Omega', 'omega'], ['Orient', 'orient'], ['Casio', 'casio'], ['Seiko', 'seiko'], ['G-Shock', 'gshock'],
];

const servicos = [
  ['revisao', 'Revisão completa', 'Limpeza, lubrificação e regulagem'],
  ['bateria', 'Troca de bateria', 'Baterias de qualidade e vedação'],
  ['polimento', 'Polimento', 'Restauração do brilho e do acabamento'],
  ['pecas', 'Troca de peças', 'Peças de qualidade e compatíveis'],
  ['gota', 'Teste de estanqueidade', 'Segurança para o uso diário'],
];

// ------------------------------------------------------------------ blocos comuns
function head({ base, titulo, descricao, canonico, ogImagem, extra = '' }) {
  const abs = u => (loja.site ? loja.site.replace(/\/$/, '') + '/' + u : null);
  return `<!doctype html>
<html lang="pt-BR" data-base="${base}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descricao)}">
<meta name="theme-color" content="#fcfbf9">
<meta name="color-scheme" content="light">
<meta name="format-detection" content="telephone=no">
${abs(canonico) ? `<link rel="canonical" href="${abs(canonico)}">` : ''}
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="${esc(loja.nome)}">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descricao)}">
${abs(ogImagem) ? `<meta property="og:image" content="${abs(ogImagem)}">` : ''}
<link rel="icon" href="${base}assets/icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="${base}assets/icons/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="${base}assets/icons/apple-touch-icon.png">
<link rel="preload" href="${base}assets/fonts/google-sans-flex-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${base}assets/css/site.css?v=${V}">
${extra}
<script type="module" src="${base}assets/js/site.js?v=${V}"></script>
</head>`;
}

const marcaLK = (cls = '') => `<span class="lk-logo${cls ? ' ' + cls : ''}">${svg('lk')}</span>`;
const marcaCompleta = () => `${marcaLK()}<span class="wordmark-wrap">${svg('relogios')}</span>`;

function topo(base) {
  return `
<header class="topo" data-topo>
  <div class="topo-in">
    <a class="topo-marca" href="${base}" aria-label="${esc(loja.nome)}, página inicial">${marcaCompleta()}</a>
    <div class="topo-acoes">
      <button class="icone-btn" type="button" data-abrir="busca" aria-label="Buscar relógios">${icon('busca')}</button>
      <button class="icone-btn icone-carrinho" type="button" data-abrir="carrinho" aria-label="Carrinho" data-carrinho-btn>${icon('carrinho')}<span class="selo" data-carrinho-qtd aria-hidden="true">0</span></button>
      <button class="icone-btn" type="button" data-abrir="menu" aria-label="Abrir menu" aria-haspopup="dialog">${icon('menu')}</button>
    </div>
  </div>
</header>`;
}

/** Conteúdo da tela 6: usado no rodapé e no menu. */
function marcaERedes(base, { idPrefixo, comAssinatura = true, links }) {
  return `
  <div class="assinatura-marca">${marcaLK('lk-grande')}</div>
  <p class="slogan">${esc(loja.slogan[0])}<br>${esc(loja.slogan[1])}</p>
  <nav class="links-nav" aria-label="${idPrefixo === 'menu' ? 'Menu' : 'Rodapé'}">
    <ul class="links">${links}</ul>
  </nav>
  <ul class="redes">
    <li><a href="${instagram}" target="_blank" rel="noopener" aria-label="Instagram da ${esc(loja.nome)}">${icon('instagram')}</a></li>
    <li><a href="${wa(`Olá, ${loja.nome}! Vim pelo site.`)}" target="_blank" rel="noopener" aria-label="WhatsApp da ${esc(loja.nome)}">${icon('whatsapp')}</a></li>
  </ul>
  ${comAssinatura ? `<hr class="divisor">
  <p class="copy"><span class="copy-nome">${esc(loja.nome)}</span><span>Todos os direitos reservados.</span><span>${esc(loja.cidade)}</span></p>` : ''}`;
}

const itensMenu = base => [
  ['Relógios', 'Coleção de alta qualidade', '#relogios'],
  ['Assistência técnica', 'Revisão, bateria e polimento', '#servicos'],
  ['Sobre nós', 'Quem somos e como trabalhamos', '#sobre'],
  ['Contato', 'WhatsApp e Instagram', '#contato'],
].map(([t, d, h], i) => `<li style="--i:${i}"><a href="${base}${h}" data-fechar><span class="menu-num">0${i + 1}</span><span class="menu-txt"><span class="menu-titulo">${t}</span><span class="menu-desc">${d}</span></span>${icon('seta', 'menu-seta')}</a></li>`).join('\n        ');

// Três linhas que viram X quando o menu abre (animação em CSS).
const ICONE_HAMBURGUER_X = '<svg class="ico ico-hx" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true" focusable="false"><path class="hx1" d="M3.5 12h17"/><path class="hx2" d="M3.5 12h17"/><path class="hx3" d="M3.5 12h17"/></svg>';

const linksPrincipais = (base, extraAttr = '') => [
  ['Relógios', `${base}#relogios`], ['Assistência Técnica', `${base}#servicos`], ['Sobre Nós', `${base}#sobre`], ['Contato', `${base}#contato`],
].map(([t, h]) => `<li><a href="${h}"${extraAttr}>${t}</a></li>`).join('');

function rodape(base) {
  return `
<footer class="rodape" id="contato">
  <div class="rodape-in">${marcaERedes(base, { idPrefixo: 'rodape', links: linksPrincipais(base) })}
  </div>
</footer>`;
}

/** Diálogos: menu (tela 6), busca e carrinho. */
function dialogos(base) {
  return `
<dialog class="dlg dlg-menu" id="menu" aria-label="Menu">
  <div class="menu">
    <div class="topo-in menu-topo">
      <a class="topo-marca" href="${base}" aria-label="${esc(loja.nome)}, página inicial" data-fechar>${marcaCompleta()}</a>
      <div class="topo-acoes"><button class="icone-btn menu-fechar" type="button" data-fechar aria-label="Fechar menu" autofocus>${ICONE_HAMBURGUER_X}</button></div>
    </div>
    <nav class="menu-nav" aria-label="Menu principal">
      <ol class="menu-lista">
        ${itensMenu(base)}
      </ol>
    </nav>
    <section class="menu-destaques" aria-labelledby="menu-destaques-t" style="--i:4">
      <p class="sobretitulo" id="menu-destaques-t">Em destaque</p>
      <ul class="menu-trilho">${produtos.map(p => `
        <li><a class="mini" href="${base}relogio/${p.slug}/">${picture(p.imagens[0], { ...RELOGIO, base, cls: 'mini-foto', alt: '', sizes: 'calc(min(100vw, 440px) * 0.22)' })}<span class="mini-marca">${esc(p.marca)}</span><span class="mini-modelo">${esc(p.modelo)}</span><span class="mini-preco">${brl(p.preco)}</span></a></li>`).join('')}
      </ul>
    </section>
    <div class="menu-pe" style="--i:5">
      <a class="btn btn-escuro menu-wa" href="${wa(`Olá, ${loja.nome}! Vim pelo site.`)}" target="_blank" rel="noopener">${icon('whatsapp')}Fale com a gente</a>
      <a class="menu-ig" href="${instagram}" target="_blank" rel="noopener" aria-label="Instagram da ${esc(loja.nome)}">${icon('instagram')}</a>
    </div>
    <p class="menu-assina" style="--i:6"><span>${esc(loja.slogan[0])}, ${esc(loja.slogan[1])}</span><span>${esc(loja.nome)} · ${esc(loja.cidade)}</span></p>
  </div>
</dialog>

<dialog class="dlg dlg-busca" id="busca" aria-label="Buscar relógios">
  <div class="busca-in">
    <form class="busca-campo" role="search" data-busca-form>
      ${icon('busca')}
      <label class="sr" for="busca-q">Buscar por marca ou modelo</label>
      <input id="busca-q" type="search" name="q" placeholder="Buscar marca ou modelo" autocomplete="off" enterkeyhint="search" data-busca-q>
      <button class="icone-btn" type="button" data-fechar aria-label="Fechar busca">${icon('fechar')}</button>
    </form>
    <div class="busca-res" data-busca-res aria-live="polite"></div>
  </div>
</dialog>

<dialog class="dlg dlg-carrinho" id="carrinho" aria-labelledby="carrinho-titulo">
  <div class="sheet">
    <div class="sheet-topo">
      <h2 id="carrinho-titulo">Carrinho</h2>
      <button class="icone-btn" type="button" data-fechar aria-label="Fechar carrinho">${icon('fechar')}</button>
    </div>
    <div class="sheet-corpo" data-carrinho-lista></div>
    <div class="sheet-pe" data-carrinho-pe hidden>
      <p class="total"><span>Total</span><strong data-carrinho-total>R$ 0</strong></p>
      <a class="btn btn-escuro btn-largo" data-carrinho-finalizar target="_blank" rel="noopener" href="#">${icon('whatsapp')}Finalizar pelo WhatsApp</a>
      <button class="btn btn-claro btn-largo" type="button" data-fechar>Continuar comprando</button>
    </div>
  </div>
</dialog>

<div class="toast" data-toast role="status" aria-live="polite"></div>`;
}

/** Dados que o JS usa para carrinho e busca (caminhos relativos à página). */
function dadosJS(base) {
  const d = produtos.map(p => ({
    slug: p.slug, marca: p.marca, modelo: p.modelo, nome: p.nome, preco: p.preco, parcelas: p.parcelas,
    genero: p.genero, url: `${base}relogio/${p.slug}/`, img: `${base}assets/img/${p.imagens[0]}-400`,
  }));
  return `<script type="application/json" id="dados">${JSON.stringify({ loja: { nome: loja.nome, whatsapp: loja.whatsapp }, produtos: d }).replace(/</g, '\\u003c')}</script>`;
}

// ------------------------------------------------------------------ home
function card(p, base) {
  return `
    <li class="card" data-genero="${p.genero.join(' ')}" data-marca="${esc(p.marca)}">
      <a class="card-link" href="${base}relogio/${p.slug}/">
        ${picture(p.imagens[0], { ...RELOGIO, base, cls: 'card-foto', alt: p.alt, sizes: 'calc(min(100vw, 440px) * 0.315)' })}
        <h3 class="card-nome"><span class="card-marca">${esc(p.marca)}</span> <span class="card-modelo">${esc(p.modelo)}</span></h3>
        <p class="card-preco">${brl(p.preco)}</p>
      </a>
      <button class="fav" type="button" data-fav="${p.slug}" aria-pressed="false" aria-label="Favoritar ${esc(p.marca + ' ' + p.nome)}">${icon('coracao')}</button>
    </li>`;
}

function home() {
  const base = '';
  const gshock = produtos.find(p => p.slug === 'casio-g-shock-ga-2100');
  const ld = {
    '@context': 'https://schema.org', '@type': 'Store', name: loja.nome,
    description: 'Venda de relógios de alta qualidade e assistência técnica especializada.',
    address: { '@type': 'PostalAddress', addressLocality: 'João Pessoa', addressRegion: 'PB', addressCountry: 'BR' },
    ...(loja.site ? { url: loja.site } : {}),
  };
  return `${head({
    base, titulo: `${loja.nome} | Relógios de alta qualidade e assistência técnica em João Pessoa`,
    descricao: 'Relógios de alta qualidade Omega, Orient, Casio, Seiko e G-Shock, com garantia, e assistência técnica especializada em João Pessoa - PB.',
    canonico: '', ogImagem: 'assets/img/hero-speedmaster-1200.webp',
    extra: `<link rel="preload" as="image" type="image/avif" imagesrcset="assets/img/hero-speedmaster-800.avif 800w, assets/img/hero-speedmaster-1200.avif 1200w, assets/img/hero-speedmaster-1600.avif 1600w" imagesizes="min(100vw, 440px)" fetchpriority="high">
<script type="application/ld+json">${JSON.stringify(ld)}</script>`,
  })}
<body class="pg-home">
<a class="pular" href="#conteudo">Pular para o conteúdo</a>
${topo(base)}
<main id="conteudo">

<section class="hero" id="inicio" aria-labelledby="hero-titulo">
  <p class="sobretitulo">Tradição em cada segundo</p>
  <div class="hero-cabeca">
    <h1 class="hero-titulo" id="hero-titulo">Mais que<br>relógios,<br><span>confiança.</span></h1>
  </div>
  <div class="hero-corpo">
    ${picture('hero-speedmaster', { larguras: [800, 1200, 1600], w: 3548, h: 3920, base, cls: 'hero-foto', alt: '', sizes: 'min(100vw, 440px)', lazy: false, prioridade: true })}
    <p class="hero-texto">Relógios de alta qualidade e assistência técnica especializada com a excelência que o seu tempo merece.</p>
    <div class="hero-acoes">
      <a class="btn btn-escuro" href="#relogios">Ver relógios ${icon('seta')}</a>
      <a class="btn btn-vidro" href="#servicos">Nossos serviços</a>
    </div>
  </div>
  <div class="marcas">
    <p class="rotulo" id="marcas-rotulo">Marcas que trabalhamos</p>
    <ul class="marcas-lista" aria-labelledby="marcas-rotulo">
      ${marcasHero.map(([nome, arq]) => `<li><a class="marca marca-${arq}" href="#relogios" data-marca="${nome}" aria-label="Ver relógios ${nome}">${svg('marca-' + arq)}</a></li>`).join('\n      ')}
    </ul>
  </div>
</section>

<section class="secao catalogo" id="relogios" aria-labelledby="catalogo-titulo">
  <p class="sobretitulo">Explore</p>
  <h2 class="titulo" id="catalogo-titulo">Relógios de<br>alta qualidade</h2>
  <p class="subtitulo">As melhores marcas, com<br>precisão e garantia.</p>
  <div class="filtros" role="group" aria-label="Filtrar relógios">
    <button class="chip" type="button" data-filtro="todos" aria-pressed="true">Todos</button>
    <button class="chip" type="button" data-filtro="masculino" aria-pressed="false">Masculino</button>
    <button class="chip" type="button" data-filtro="feminino" aria-pressed="false">Feminino</button>
  </div>
  <p class="filtro-marca" data-filtro-marca hidden>Marca: <strong data-filtro-marca-nome></strong><button type="button" class="link-btn" data-limpar-marca>Ver todas</button></p>
  <ul class="grade" data-grade>${produtos.map(p => card(p, base)).join('')}
  </ul>
  <p class="vazio" data-vazio hidden>Nenhum relógio neste filtro por enquanto. <a href="${wa(`Olá, ${loja.nome}! Procuro um relógio e não encontrei no site.`)}" target="_blank" rel="noopener">Fale com a gente</a> que buscamos para você.</p>
</section>

<section class="secao destaque" id="destaque" aria-labelledby="destaque-titulo">
  <p class="sobretitulo">Destaque</p>
  <h2 class="destaque-titulo" id="destaque-titulo">G-Shock<span>Resistência que<br>acompanha você.</span></h2>
  ${picture(gshock.imagens[0], { ...RELOGIO, base, cls: 'destaque-foto', alt: gshock.alt, sizes: 'calc(min(100vw, 440px) * 0.692)' })}
  <p class="destaque-texto">Design robusto, tecnologia de ponta<br>e a confiabilidade que é referência<br>no mundo todo.</p>
  <a class="btn btn-escuro" href="#relogios" data-marca="G-Shock">Ver coleção ${icon('seta')}</a>
  ${picture('destaque-pedras', { larguras: [800, 1200, 1600], w: 3412, h: 1616, base, cls: 'destaque-pedras', alt: '', sizes: 'min(100vw, 440px)' })}
</section>

<section class="secao servicos" id="servicos" aria-labelledby="servicos-titulo">
  <p class="sobretitulo">Serviços</p>
  <h2 class="titulo-m" id="servicos-titulo">Assistência<br>técnica especializada</h2>
  <p class="subtitulo">Seu relógio em mãos experientes.</p>
  ${picture('assistencia-relojoeiro', { larguras: [600, 900, 1200, 1600], w: 2908, h: 1656, base, cls: 'servicos-foto', alt: 'Relojoeiro com lupa ajustando o mecanismo de um relógio', sizes: 'calc(min(100vw, 440px) - 56px)' })}
  <ul class="servicos-lista">
    ${servicos.map(([ic, t, d]) => `<li><span class="servico-icone">${icon(ic)}</span><span class="servico-txt"><strong>${t}</strong><span>${d}</span></span></li>`).join('\n    ')}
  </ul>
  <a class="btn btn-escuro btn-largo" href="${wa(`Olá, ${loja.nome}! Quero solicitar um orçamento de assistência técnica.`)}" target="_blank" rel="noopener">Solicitar orçamento</a>
</section>

<section class="secao sobre" id="sobre" aria-labelledby="sobre-titulo">
  <p class="sobretitulo">Sobre nós</p>
  <h2 class="titulo-m" id="sobre-titulo">Alta qualidade<br>e cuidado de especialista.</h2>
  <p class="subtitulo">Em ${esc(loja.cidade.replace(' - ', ', '))}, a ${esc(loja.nome)} reúne marcas consagradas, com qualidade e garantia, e uma assistência técnica que trata cada relógio com a atenção que ele merece.</p>
  <ul class="valores">
    <li><span>Qualidade</span>Acabamento e serviço feitos para durar.</li>
    <li><span>Precisão</span>Cada detalhe conferido, do mostrador à pulseira.</li>
    <li><span>Experiência</span>Atendimento próximo, antes e depois da compra.</li>
  </ul>
</section>

</main>
${rodape(base)}
${dialogos(base)}
${dadosJS(base)}
</body>
</html>
`;
}

// ------------------------------------------------------------------ produto
function paginaProduto(p) {
  const base = '../../';
  const titulo = `${p.marca} ${p.nome} | ${loja.nome}`;
  const descricao = `${p.marca} ${p.nome}: ${p.specs.join(', ')}. ${brl(p.preco)} em até ${p.parcelas}x de ${parcela(p)}. ${p.sobre}`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'Product', name: `${p.marca} ${p.nome}`,
    brand: { '@type': 'Brand', name: p.marca }, description: p.sobre,
    ...(loja.site ? { image: `${loja.site.replace(/\/$/, '')}/assets/img/${p.imagens[0]}-1200.webp` } : {}),
    offers: { '@type': 'Offer', priceCurrency: 'BRL', price: p.preco.toFixed(2), availability: 'https://schema.org/InStock', itemCondition: 'https://schema.org/NewCondition', seller: { '@type': 'Organization', name: loja.nome } },
  };
  const imgs = p.imagens.map((im, i) => `<div class="galeria-slide" role="group" aria-roledescription="imagem" aria-label="${i + 1} de ${p.imagens.length}">${picture(im, { ...RELOGIO, base, alt: i === 0 ? p.alt : `${p.alt}, foto ${i + 1}`, sizes: 'calc(min(100vw, 440px) * 0.554)', lazy: i > 0, prioridade: i === 0 })}</div>`).join('');
  const pontos = p.imagens.length > 1
    ? `<div class="galeria-pontos" aria-hidden="true">${p.imagens.map((_, i) => `<span${i === 0 ? ' class="ativo"' : ''}></span>`).join('')}</div>` : '';
  return `${head({
    base, titulo, descricao, canonico: `relogio/${p.slug}/`, ogImagem: `assets/img/${p.imagens[0]}-1200.webp`,
    extra: `<script type="application/ld+json">${JSON.stringify(ld)}</script>`,
  })}
<body class="pg-produto">
<a class="pular" href="#conteudo">Pular para o conteúdo</a>
<header class="produto-topo" data-topo>
  <div class="topo-in">
    <a class="icone-btn" href="${base}#relogios" aria-label="Voltar para os relógios" data-voltar>${icon('voltar')}</a>
    <div class="topo-acoes">
      <button class="icone-btn fav" type="button" data-fav="${p.slug}" aria-pressed="false" aria-label="Favoritar ${esc(p.marca + ' ' + p.nome)}">${icon('coracao')}</button>
      <button class="icone-btn" type="button" data-compartilhar aria-label="Compartilhar">${icon('compartilhar')}</button>
    </div>
  </div>
</header>
<main id="conteudo" class="produto">
  <div class="galeria" aria-label="Fotos do ${esc(p.marca + ' ' + p.nome)}">
    <div class="galeria-trilho" data-galeria>${imgs}</div>
    ${pontos}
  </div>
  <div class="produto-info">
    <p class="produto-logo produto-logo-${p.logo}"><span class="sr">${esc(p.marca)}</span>${svg('marca-' + p.logo)}</p>
    <h1 class="produto-nome"><span class="sr">${esc(p.marca)} </span>${esc(p.nome)}</h1>
    <p class="produto-specs">${p.specs.map(esc).join('<span aria-hidden="true"> | </span><span class="sr">, </span>')}</p>
    <p class="produto-preco">${brl(p.preco)}</p>
    <p class="produto-parcelas">Em até ${p.parcelas}x de ${parcela(p)}</p>
    <button class="btn btn-escuro btn-largo btn-comprar" type="button" data-adicionar="${p.slug}">Adicionar ao carrinho</button>
    <ul class="selos">
      <li>${icon('medalha')}<span>Alta qualidade</span></li>
      <li>${icon('escudo')}<span>Garantia da loja</span></li>
      <li>${icon('caixa')}<span>Envio seguro</span></li>
    </ul>
    <section class="produto-sobre" aria-labelledby="sobre-produto">
      <h2 id="sobre-produto">Sobre o produto</h2>
      <p>${esc(p.sobre)}</p>
    </section>
    <section class="produto-ficha" aria-labelledby="ficha-produto">
      <h2 id="ficha-produto">Ficha técnica</h2>
      <dl>${p.ficha.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    </section>
    <a class="btn btn-claro btn-largo" href="${wa(`Olá, ${loja.nome}! Tenho uma dúvida sobre o ${p.marca} ${p.nome}.`)}" target="_blank" rel="noopener">${icon('whatsapp')}Tirar dúvidas pelo WhatsApp</a>
  </div>
</main>
${rodape(base)}
${dialogos(base)}
${dadosJS(base)}
</body>
</html>
`;
}

// ------------------------------------------------------------------ escrita
const aviso = '<!-- Gerado por scripts/build.mjs (npm run build). Não edite à mão. -->\n';
const escreve = (arq, html) => {
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, html.replace('<!doctype html>\n', '<!doctype html>\n' + aviso));
  console.log(arq, (Buffer.byteLength(html) / 1024).toFixed(1) + ' KB');
};
escreve('index.html', home());
for (const p of produtos) escreve(`relogio/${p.slug}/index.html`, paginaProduto(p));
