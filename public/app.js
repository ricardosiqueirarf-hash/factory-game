const $ = (selector) => document.querySelector(selector);

const state = {
  kaikyFatigue: true,
  paMode: 'p4'
};

const els = {
  kaikyFatigue: $('#kaikyFatigue'),
  paMode: $('#paMode'),
  simulateButton: $('#simulateButton'),
  teamsGrid: $('#teamsGrid'),
  probabilityBars: $('#probabilityBars'),
  rankingList: $('#rankingList'),
  balanceIndex: $('#balanceIndex'),
  spread: $('#spread'),
  stdDev: $('#stdDev'),
  controversyIndex: $('#controversyIndex'),
  simulationCount: $('#simulationCount'),
  decisionCard: $('#decisionCard'),
  decisionStatus: $('#decisionStatus'),
  decisionNote: $('#decisionNote'),
  decisionConfidence: $('#decisionConfidence'),
  institutionalReading: $('#institutionalReading'),
  toast: $('#toast')
};

function formatNumber(value, digits = 2) {
  return Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => els.toast.classList.remove('show'), 2500);
}

function setLoading(isLoading) {
  els.simulateButton.classList.toggle('loading', isLoading);
  els.simulateButton.disabled = isLoading;
  els.simulateButton.querySelector('span').textContent = isLoading ? 'SIMULANDO...' : 'RODAR O MODELO';
}

function renderTeams(teams) {
  els.teamsGrid.innerHTML = teams.map((team) => {
    const players = team.players.map((player) => {
      const context = player.context
        ? `<small class="player-context">${escapeHtml(player.context)}</small>`
        : `<small>${escapeHtml(player.role)}</small>`;

      return `
        <div class="player-row">
          <div class="player-name">
            <strong>${escapeHtml(player.name)}</strong>
            ${context}
          </div>
          <span class="pot-badge">P${escapeHtml(player.pot)}</span>
          <span class="player-rating">${formatNumber(player.rating, 2)}</span>
        </div>
      `;
    }).join('');

    return `
      <article class="team-card" style="--team-color:${team.color}">
        <div class="team-accent"></div>
        <div class="team-head">
          <div>
            <h3>${escapeHtml(team.name)}</h3>
            <p>${escapeHtml(team.label)}</p>
          </div>
          <div class="team-score">
            <span>FORÇA AJUSTADA</span>
            <strong>${formatNumber(team.strength, 2)}</strong>
          </div>
        </div>
        <div class="player-list">${players}</div>
        <div class="team-footer">
          <div>
            <span>CHANCE DE 1º</span>
            <strong>${formatNumber(team.winProbability, 1)}%</strong>
          </div>
          <div>
            <span>VOLATILIDADE</span>
            <strong>${formatNumber(team.volatility, 2)}</strong>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function renderProbabilities(teams) {
  els.probabilityBars.innerHTML = teams.map((team) => `
    <div class="probability-row">
      <strong>${escapeHtml(team.name)}</strong>
      <div class="bar-track">
        <div class="bar-fill" style="--bar-color:${team.color}; width:${team.winProbability}%"></div>
      </div>
      <span class="probability-value">${formatNumber(team.winProbability, 1)}%</span>
    </div>
  `).join('');
}

function renderRanking(ranking) {
  const medals = ['01', '02', '03'];
  els.rankingList.innerHTML = ranking.map((entry, index) => `
    <div class="ranking-row">
      <span class="rank-number">${medals[index] || String(index + 1).padStart(2, '0')}</span>
      <strong>${escapeHtml(entry.teamName)}</strong>
      <b>${formatNumber(entry.probability, 1)}%</b>
    </div>
  `).join('');
}

function renderDecision(data) {
  const { metrics, decision, metadata, assumptions } = data;

  els.balanceIndex.textContent = `${formatNumber(metrics.balanceIndex, 1)}/100`;
  els.spread.textContent = formatNumber(metrics.spread, 3);
  els.stdDev.textContent = formatNumber(metrics.stdDev, 3);
  els.controversyIndex.textContent = `${formatNumber(metrics.controversyIndex, 0)}%`;
  els.simulationCount.textContent = Number(metadata.simulations).toLocaleString('pt-BR');

  els.decisionStatus.textContent = decision.status;
  els.decisionNote.textContent = decision.note;
  els.decisionConfidence.textContent = decision.confidence;
  els.decisionCard.classList.toggle('revise', decision.status !== 'APROVADO');

  const fatiguePhrase = assumptions.kaikyFatigue
    ? 'Kaiky está sendo precificado com desconto de fadiga.'
    : 'Kaiky está sendo avaliado sem desconto de fadiga.';

  const paPhrase = assumptions.paMode === 'p2'
    ? 'PA foi promovido ao P2 e o mercado entrou em pânico.'
    : assumptions.paMode === 'p3'
      ? 'PA opera sob regime intermediário de P3.'
      : 'PA permanece contabilizado como P4 de risco.';

  els.institutionalReading.textContent = `${fatiguePhrase} ${paPhrase} Índice de equilíbrio em ${formatNumber(metrics.balanceIndex, 1)} pontos.`;
}

async function simulate({ initial = false } = {}) {
  state.kaikyFatigue = els.kaikyFatigue.checked;
  state.paMode = els.paMode.value;

  setLoading(true);

  try {
    const response = await fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kaikyFatigue: state.kaikyFatigue,
        paMode: state.paMode,
        simulations: 25000
      })
    });

    if (!response.ok) {
      throw new Error(`Falha HTTP ${response.status}`);
    }

    const data = await response.json();
    renderTeams(data.teams);
    renderProbabilities(data.teams);
    renderRanking(data.ranking);
    renderDecision(data);

    if (!initial) {
      showToast('Modelo recalibrado. A narrativa estatística foi atualizada com sucesso.');
    }
  } catch (error) {
    console.error(error);
    els.decisionStatus.textContent = 'ERRO';
    els.decisionNote.textContent = 'O algoritmo se recusou a participar da discussão do grupo.';
    els.decisionConfidence.textContent = '0% institucional';
    els.decisionCard.classList.add('revise');
    showToast('Não foi possível rodar o modelo. Verifique se o servidor está online.');
  } finally {
    setLoading(false);
  }
}

els.simulateButton.addEventListener('click', () => simulate());
els.kaikyFatigue.addEventListener('change', () => simulate());
els.paMode.addEventListener('change', () => simulate());

simulate({ initial: true });
