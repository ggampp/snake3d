# Snake 3D 🐍🪐

Um "jogo da cobrinha" em 3D inspirado [neste vídeo](https://x.com/0xdn7/status/2062174010553901062):
a cobra desliza pela **superfície de um planeta esférico**, comendo orbes
brilhantes enquanto a câmera a segue em terceira pessoa. Feito com **Three.js**.

![preview](docs/preview.png)

## Como jogar

- **← / →** ou **A / D** — virar para a esquerda / direita
- **Toque** na metade esquerda/direita da tela (mobile)
- A cobra avança sozinha; você só controla a direção
- Colete as **bolas de energia amarelas** para crescer e pontuar — elas
  aparecem, ficam alguns segundos e somem; quanto maior a bola, **mais a
  cobra cresce** (proporcional à energia)
- Cuidado com as **minhocas inimigas** vermelhas que vagam pelo planeta:
  encostar em uma é **game over**
- Encostar no próprio corpo também é **game over**
- A velocidade aumenta conforme você pontua

## Rodando localmente

```bash
npm install
npm run dev       # servidor de desenvolvimento (Vite)
```

Build estático para deploy (ex.: GitHub Pages, Netlify):

```bash
npm run build     # gera ./dist
npm run preview   # serve o build localmente
```

## Como funciona

O coração do jogo é mover-se sobre uma esfera unitária
(`src/core/SphereMath.js`):

- A cabeça tem uma **posição** (vetor unitário) e um **heading** (tangente).
- A cada frame ela avança ao longo de uma **geodésica** (grande círculo),
  rotacionando em torno do eixo `posição × heading`.
- Virar gira o heading em torno da **normal local** (a própria posição).
- O corpo é um histórico do caminho, **reamostrado** em espaçamentos de arco
  fixos para posicionar os segmentos atrás da cabeça (seguir + crescer suave).

### Estrutura

```
src/
├── main.js            bootstrap, loop, estado e regras do jogo
├── core/
│   ├── SphereMath.js  geodésicas, slerp, orientação na superfície
│   ├── Camera.js      câmera de perseguição em 3ª pessoa
│   └── Input.js       teclado + touch + mouse
├── world/
│   ├── Planet.js      esfera + atmosfera (fresnel) com shaders
│   ├── Sky.js         campo de estrelas + nebulosa (fbm noise)
│   └── Grass.js       tufos instanciados (distribuição de Fibonacci)
├── entities/
│   ├── Crawler.js     base: caminho na esfera + corpo em tubo contínuo
│   ├── TubeBody.js    gera o tubo (frames paralelos, com afinamento)
│   ├── Snake.js       cobra do jogador (olhos, comer, colisão)
│   ├── EnemyWorm.js   minhoca inimiga com IA de perambulação
│   └── EnergyField.js bolas de energia temporárias (pool fixo de luzes)
└── ui/
    ├── Hud.js         score, stats e tela de game over
    └── hud.css        estilos do overlay
```

O visual usa pós-processamento (`UnrealBloomPass`) para o brilho da cobra e
da comida, atmosfera por *fresnel* e tone mapping ACES.

## Testes

```bash
npm test              # testes de lógica (geodésica, comer, colisão)
```

Há também testes headless de ponta a ponta com Puppeteer (exigem o preview
rodando em outra aba do terminal):

```bash
npm run preview &
node scripts/autopilot.mjs   # dirige a cobra até a comida e valida score/crescimento
node scripts/shot.mjs        # captura screenshots da cena
```
