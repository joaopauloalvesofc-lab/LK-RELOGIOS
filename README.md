# LK Relógios

Site da LK Relógios (João Pessoa - PB): venda de relógios de alta qualidade e assistência técnica.
Site estático, pensado primeiro para o celular, feito a partir de 6 telas de referência
(`source/referencias/ref-1.png` a `ref-6.png`).

## Rodar

```bash
npm install
npm run dev        # http://localhost:3005 (na rede local: http://<ip-do-mac>:3005)
```

Para publicar, sirva a pasta como site estático (GitHub Pages, Vercel, Netlify etc.). Os caminhos
são relativos, então o site funciona na raiz do domínio ou numa subpasta.

## Páginas

| Arquivo | Conteúdo |
| --- | --- |
| `index.html` | Hero (tela 1), catálogo com filtros (tela 2), destaque G-Shock (tela 5), serviços (tela 4), sobre nós e rodapé (tela 6) |
| `relogio/<slug>/index.html` | Uma página por relógio (tela 3) |

Menu, busca e carrinho são diálogos presentes em todas as páginas. O carrinho finaliza o pedido
pelo WhatsApp com a lista de itens e o total. Carrinho e favoritos ficam no navegador do visitante.

## Editar conteúdo

- **Dados da loja** (WhatsApp, Instagram, cidade, URL final): `data/loja.json`.
- **Relógios** (nome, preço, parcelas, especificações, texto, ficha técnica): `data/produtos.json`.
- Depois de editar, rode `npm run build`. **Não edite os `.html` gerados à mão.**

Para incluir um relógio novo, adicione a entrada em `data/produtos.json`. A foto deve seguir o
pipeline abaixo (fundo claro, tela 2:3, corpo do relógio com 84% da altura), para ficar do mesmo
tamanho dos outros nos cards.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run build` | Gera `index.html` e as páginas dos relógios a partir de `data/` e `src/` |
| `npm run images` | Recorta as fotos das referências, limpa o hero, amplia 4× e exporta AVIF/WebP em `assets/img` |
| `npm run logos` | Gera os SVGs da marca (LK, "RELÓGIOS"), das marcas de relógio e os favicons |

`npm run images` precisa do [Real-ESRGAN ncnn](https://github.com/xinntao/Real-ESRGAN/releases)
(`realesrgan-ncnn-vulkan`, macOS) em `~/.local/share/realesrgan/`, ou no caminho da variável
`REALESRGAN`. As imagens intermediárias ficam em `source/work/`, fora do git; as finais, em
`assets/img/`, estão no repositório, então só é preciso rodar de novo se as fotos mudarem.

Ferramentas de conferência em `scripts/dev/`: `compare.mjs` (referência e site lado a lado e
sobrepostos), `delta.mjs` (diferença em px entre os dois) e `shot.mjs` (captura em tela de celular).

## Decisões de design

- **Escala**: tudo é medido na unidade CSS `--u`, que vale 1 px numa tela de 393 px de largura e
  acompanha a largura do celular. Assim a composição das referências se mantém em qualquer aparelho.
  Acima de 440 px o site vira uma coluna centralizada.
- **Tipografia**: Google Sans Flex (eixos de peso e largura). O título do hero usa largura 95% e
  entrelinha 1,0: menos que isso, o "g" de "relógios" encosta no "fi" de "confiança".
  "RELÓGIOS" é um SVG com os contornos da Michroma (estilo Microgramma) engrossados.
- **Monograma LK**: redesenhado a partir do cabeçalho da tela 1, com o K de haste inteira.
- **Imagens**: tiradas das próprias referências. No hero, o parágrafo, os botões e o rótulo das
  marcas foram removidos da foto (preenchimento suave; o trecho do bisel sob o botão foi refeito
  por interpolação ao longo do círculo). Tudo foi ampliado 4× com Real-ESRGAN.
- **Relógios**: fundo normalizado para branco, exibidos com `mix-blend-mode: multiply` sobre o
  cinza dos cards.
- **Textos**: o site fala em qualidade ("alta qualidade", "precisão", "Garantia da loja"). Não usar
  "original", "autêntico", "procedência", "genuíno" nem "garantia oficial".
- **Menu**: desenho próprio (itens numerados, destaques, WhatsApp). Ao abrir, o menu mede a altura
  da tela e compacta espaços e miniaturas para caber inteiro, sem rolagem.
- **Galeria do produto**: os pontos só aparecem quando o relógio tem 2 fotos ou mais.

## Pendências

- URL final do site em `data/loja.json` (ativa o link canônico e a imagem de compartilhamento).

Contatos atuais (em `data/loja.json`): WhatsApp (83) 99840-1797 e Instagram @lkrelogios12.

## Créditos

- Google Sans Flex e Michroma: SIL Open Font License.
- Logotipos Omega, Orient, Casio, Seiko e G-Shock: marcas registradas dos seus donos; arquivos
  vetoriais da Wikimedia Commons / Wikipedia.
