const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const players = {
  Felipe: { pot: 1, rating: 8.43, role: 'Motor técnico', volatility: 0.42 },
  Sam: { pot: 1, rating: 8.42, role: 'Referência ofensiva', volatility: 0.46 },
  Levi: { pot: 1, rating: 8.18, role: 'Desequilíbrio individual', volatility: 0.44 },
  Kaiky: { pot: 2, rating: 7.87, role: 'P2 premium / P1 cansado', volatility: 0.58 },
  Davi: { pot: 2, rating: 7.92, role: 'Estabilizador', volatility: 0.43 },
  Fabricio: { pot: 2, rating: 7.53, role: 'Conector', volatility: 0.47 },
  Gab: { pot: 3, rating: 7.68, role: 'Volume e chegada', volatility: 0.49 },
  Rafinha: { pot: 3, rating: 7.45, role: 'Equilíbrio', volatility: 0.45 },
  Lucas: { pot: 3, rating: 7.28, role: 'Apoio estrutural', volatility: 0.46 },
  Bernardo: { pot: 4, rating: 7.08, role: 'Operacional', volatility: 0.51 },
  Vina: { pot: 4, rating: 7.00, role: 'Operacional', volatility: 0.50 },
  Enzo: { pot: 4, rating: 6.85, role: 'Operacional', volatility: 0.50 },
  Ricardo: { pot: 4, rating: 6.75, role: 'Operacional', volatility: 0.50 },
  Joao: { pot: 4, rating: 6.68, role: 'Operacional', volatility: 0.51 },
  PA: { pot: 4, rating: 6.93, role: 'Ativo de classificação duvidosa', volatility: 0.72 },
  Marcos: { pot: 5, rating: 6.40, role: 'Controle de teto', volatility: 0.53 },
  Guilherme: { pot: 5, rating: 6.40, role: 'Controle de teto', volatility: 0.53 },
  Cacique: { pot: 5, rating: 6.18, role: 'Amortecedor estatístico', volatility: 0.55 }
};

const baseTeams = [
  { id: 1, name: 'Time 1', color: '#ef5350', players: ['Felipe', 'Davi', 'Lucas', 'Bernardo', 'Vina', 'Cacique'], chemistry: 0.08, label: 'Estrutura convencional' },
  { id: 2, name: 'Time 2', color: '#42a5f5', players: ['Sam', 'Kaiky', 'Gab', 'PA', 'Guilherme', 'Marcos'], chemistry: 0.03, label: 'Alta volatilidade' },
  { id: 3, name: 'Time 3', color: '#66bb6a', players: ['Levi', 'Fabricio', 'Rafinha', 'Enzo', 'Ricardo', 'Joao'], chemistry: 0.10, label: 'Baixa variância interna' }
];

function gaussianRandom() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resolvePlayer(name, options) {
  const original = players[name];
  const resolved = { ...original };

  if (name === 'Kaiky' && options.kaikyFatigue) {
    resolved.rating -= 0.42;
    resolved.context = 'CDFPR aplicado: -0,42';
  }

  if (name === 'PA') {
    const paMode = options.paMode || 'p4';
    if (paMode === 'p2') {
      resolved.rating = 7.62;
      resolved.pot = 2;
      resolved.context = 'Cenário PA modo P2';
    } else if (paMode === 'p3') {
      resolved.rating = 7.25;
      resolved.pot = 3;
      resolved.context = 'Cenário PA modo P3';
    }
  }

  return resolved;
}

function calculateTeams(options) {
  return baseTeams.map((team) => {
    const resolvedPlayers = team.players.map((name) => ({ name, ...resolvePlayer(name, options) }));
    const mean = resolvedPlayers.reduce((sum, player) => sum + player.rating, 0) / resolvedPlayers.length;
    const volatility = resolvedPlayers.reduce((sum, player) => sum + player.volatility, 0) / resolvedPlayers.length;

    // O coeficiente de química é deliberadamente pequeno para não dominar a nota individual.
    const strength = mean + team.chemistry;

    return {
      ...team,
      resolvedPlayers,
      mean,
      strength,
      volatility
    };
  });
}

function simulate(options = {}) {
  const simulations = clamp(Number(options.simulations) || 25000, 5000, 100000);
  const teams = calculateTeams(options);
  const wins = Object.fromEntries(teams.map((team) => [team.id, 0]));
  const podiumScore = Object.fromEntries(teams.map((team) => [team.id, 0]));

  for (let i = 0; i < simulations; i += 1) {
    const performances = teams.map((team) => ({
      id: team.id,
      performance: team.strength + gaussianRandom() * (0.48 + team.volatility * 0.22)
    })).sort((a, b) => b.performance - a.performance);

    wins[performances[0].id] += 1;
    podiumScore[performances[0].id] += 3;
    podiumScore[performances[1].id] += 1;
  }

  const strengths = teams.map((team) => team.strength);
  const spread = Math.max(...strengths) - Math.min(...strengths);
  const average = strengths.reduce((a, b) => a + b, 0) / strengths.length;
  const variance = strengths.reduce((sum, value) => sum + (value - average) ** 2, 0) / strengths.length;
  const stdDev = Math.sqrt(variance);
  const balanceIndex = clamp(100 - spread * 34, 0, 100);

  const enrichedTeams = teams.map((team) => ({
    id: team.id,
    name: team.name,
    color: team.color,
    label: team.label,
    chemistry: team.chemistry,
    strength: Number(team.strength.toFixed(3)),
    mean: Number(team.mean.toFixed(3)),
    volatility: Number(team.volatility.toFixed(3)),
    winProbability: Number(((wins[team.id] / simulations) * 100).toFixed(1)),
    expectedPointsIndex: Number((podiumScore[team.id] / simulations).toFixed(2)),
    players: team.resolvedPlayers.map((player) => ({
      name: player.name,
      pot: player.pot,
      rating: Number(player.rating.toFixed(2)),
      role: player.role,
      context: player.context || null
    }))
  }));

  const sorted = [...enrichedTeams].sort((a, b) => b.winProbability - a.winProbability);
  const approved = balanceIndex >= 92;

  return {
    metadata: {
      model: 'KADU-π / Racha Equilibrium Engine',
      version: '1.0.0',
      simulations,
      scientificValidity: 'absolutamente nenhuma',
      generatedAt: new Date().toISOString()
    },
    assumptions: {
      kaikyFatigue: Boolean(options.kaikyFatigue),
      paMode: options.paMode || 'p4',
      hardConstraints: ['Felipe e Levi jamais no mesmo time']
    },
    metrics: {
      averageStrength: Number(average.toFixed(3)),
      spread: Number(spread.toFixed(3)),
      stdDev: Number(stdDev.toFixed(3)),
      coefficientOfVariation: Number(((stdDev / average) * 100).toFixed(2)),
      balanceIndex: Number(balanceIndex.toFixed(1)),
      controversyIndex: options.paMode === 'p2' ? 94 : options.kaikyFatigue ? 81 : 88
    },
    ranking: sorted.map((team, index) => ({ position: index + 1, teamId: team.id, teamName: team.name, probability: team.winProbability })),
    decision: {
      status: approved ? 'APROVADO' : 'REVISAR',
      confidence: approved ? '95,7% de confiança inventada' : 'modelo detectou risco de choradeira',
      note: approved
        ? 'Distribuição estatisticamente aceitável para fins de resenha e governança recreativa.'
        : 'A dispersão ultrapassou o limite político tolerável do Conselho Supremo do Racha.'
    },
    teams: enrichedTeams
  };
}

app.get('/api/model', (req, res) => {
  res.json({
    name: 'KADU-π / Racha Equilibrium Engine',
    disclaimer: 'Modelo humorístico. Não possui qualquer validade científica real.',
    formula: 'Força = média(rating contextual) + química; vitória = Monte Carlo com ruído gaussiano',
    variables: [
      'rating-base',
      'pote',
      'química',
      'fadiga pré-racha',
      'volatilidade',
      'restrições políticas do elenco'
    ],
    players,
    teams: baseTeams
  });
});

app.post('/api/simulate', (req, res) => {
  res.json(simulate(req.body || {}));
});

app.get('/api/simulate', (req, res) => {
  res.json(simulate({ kaikyFatigue: true, paMode: 'p4' }));
});

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'racha-analytics' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Racha Analytics rodando em http://localhost:${PORT}`);
});
