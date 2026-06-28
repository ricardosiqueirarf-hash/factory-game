# Factory Game

Jogo web tycoon de holding empresarial/industrial feito com TypeScript e Vite.

Este projeto e separado do ANODIZA, ColorGlass ou qualquer sistema empresarial real.

## Conceito

O jogador compra empresas problemáticas ou descontadas, melhora a operação, contrata managers, aumenta lucro e decide se vende a empresa valorizada ou mantém como ativo gerador de caixa.

## Loop principal

1. Acessar o mercado de empresas.
2. Comprar empresas com capital disponível.
3. Aplicar upgrades para aumentar receita, qualidade, demanda, eficiência ou reduzir custos/risco.
4. Contratar e atribuir managers.
5. Passar o mês manualmente.
6. Receber lucro/prejuízo, pagar managers e lidar com eventos.
7. Vender empresas valorizadas ou manter ativos lucrativos.
8. Aumentar capital, lucro mensal e valor total da holding.

## Stack

- TypeScript
- Vite
- localStorage para persistência local
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

- Build Command: `npm install && npm run build`
- Publish Directory: `dist`

## Gameplay atual

- Dashboard da holding
- Mercado de empresas à venda
- Compra de empresas
- Portfólio de empresas compradas
- Venda por valuation
- Upgrades por empresa
- Managers com tipo, raridade, salário e bônus
- Atribuição de manager a empresa
- Passagem manual do mês
- Eventos aleatórios
- Histórico de decisões e eventos
- Persistência local com `localStorage`

## Modelos principais

Arquivos principais:

- `src/business/holdingTypes.ts`
- `src/business/holdingLogic.ts`
- `src/business/BusinessIdleApp.ts`
- `src/business/holding.css`

## Observação

Alguns arquivos legados do protótipo 3D/fábrica ainda existem no repositório, mas o entrypoint atual do jogo usa o MVP de holding empresarial.
