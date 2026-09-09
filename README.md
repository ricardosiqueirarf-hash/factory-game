# Racha Analytics

> Decision Intelligence for Questionable Institutions™

Mini site fullstack criado para resolver, com rigor estatístico completamente desnecessário, a escalação do racha de sexta-feira.

## O que existe

- Dashboard responsivo com os 3 times sugeridos.
- Potes e ratings individuais.
- Restrição rígida: Felipe e Levi não podem jogar no mesmo time.
- Ajuste de fadiga pré-racha do Kaiky.
- Cenários alternativos para PA como P4, P3 ou P2.
- Backend Express com simulação Monte Carlo.
- Probabilidade estimada de cada time terminar em primeiro.
- Índice de equilíbrio, dispersão, desvio padrão e índice de polêmica.
- Parecer automático do Conselho Supremo do Racha.
- API pública simples para recalcular cenários.

## Rodar localmente

Requer Node.js 18+.

```bash
npm install
npm start
```

Depois abra:

```text
http://localhost:3000
```

Para desenvolvimento com reload do Node:

```bash
npm run dev
```

## API

### GET `/api/model`

Retorna premissas, jogadores, ratings-base e estrutura dos times.

### GET `/api/simulate`

Retorna o cenário padrão com Kaiky cansado e PA como P4.

### POST `/api/simulate`

Exemplo:

```json
{
  "kaikyFatigue": true,
  "paMode": "p4",
  "simulations": 25000
}
```

`paMode` aceita `p4`, `p3` ou `p2`.

### GET `/health`

Healthcheck do backend.

## Modelo

A força de uma equipe é calculada aproximadamente como:

```text
Força = média(rating contextual dos jogadores) + coeficiente de química
```

Depois o backend executa milhares de simulações. Em cada simulação, cada equipe recebe uma performance aleatória ao redor de sua força estimada, considerando também volatilidade individual média.

O maior valor da rodada é contado como primeiro lugar.

### Ajuste Kaiky

Quando `kaikyFatigue=true`, o modelo aplica o lendário **CDFPR — Coeficiente de Depreciação Física Pré-Racha** e reduz o rating contextual de Kaiky em 0,42 ponto.

### Caso PA

PA é tratado como ativo estatístico de classificação duvidosa:

- P4: rating 6,93
- P3: rating 7,25
- P2: rating 7,62

Naturalmente, todos esses números foram selecionados através do método científico conhecido como **parece razoável**.

## Times-base

### Time 1

Felipe · Davi · Lucas · Bernardo · Vina · Cacique

### Time 2

Sam · Kaiky · Gab · PA · Guilherme · Marcos

### Time 3

Levi · Fabricio · Rafinha · Enzo · Ricardo · Joao

## Aviso científico

Este projeto é humorístico. Não possui validade científica, não representa análise esportiva profissional e certamente não deve ser citado numa discussão séria.

Por outro lado, possui Monte Carlo, desvio padrão e uma fórmula com letra grega. Portanto, é praticamente irrefutável no grupo do WhatsApp.
