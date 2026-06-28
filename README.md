# Factory Game

Jogo web tycoon industrial feito com Phaser, TypeScript e Vite.

## Objetivo

Criar um jogo de navegador onde o jogador monta uma fabrica, compra insumos, produz itens, vende estoque e reinveste em maquinas melhores.

## Stack

- Phaser 3
- TypeScript
- Vite
- Render Static Site

## Rodar localmente

```bash
npm install
npm run dev
```

Abra:

```txt
http://localhost:5173
```

## Build

```bash
npm run build
```

A pasta final gerada sera:

```txt
dist/
```

## Deploy no Render

O arquivo `render.yaml` ja esta configurado.

No Render:

1. New
2. Blueprint
3. Selecione o repositorio `factory-game`
4. Branch `main`
5. Apply

Alternativa manual como Static Site:

- Build Command: `npm install && npm run build`
- Publish Directory: `dist`

## Gameplay atual

- Compra de metal bruto
- Grid de fabrica
- Construir maquinas
- Producao automatica
- Venda de estoque
- Upgrades com Shift + clique
- Desbloqueio de maquinas por dinheiro
- Save automatico no navegador

## Controles

- Clique em uma maquina no painel para selecionar construcao
- Clique em um espaco vazio do grid para construir
- Clique em uma maquina no grid para ver upgrade
- Shift + clique em uma maquina para fazer upgrade

## Proximas features

- Contratos com prazo
- Esteiras visuais
- Funcionarios
- Pesquisa tecnologica
- Sistema de energia
- Ranking online
- Backend para save na nuvem
