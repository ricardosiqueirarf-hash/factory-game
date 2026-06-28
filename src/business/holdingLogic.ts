import { Company, EventRecord, HoldingState, Manager, ManagerBonus, ManagerRarity, ManagerType, Sector, UpgradeDefinition, UpgradeEffect } from './holdingTypes';

const STORAGE_KEY = 'factory-holding-tycoon-v1';

const COMPANY_NAMES = [
  'Marcenaria Popular',
  'Vidraçaria Industrial',
  'Oficina de Metal',
  'Fábrica de Móveis Planejados',
  'Distribuidora Regional',
  'Padaria Industrial',
  'Confecção Têxtil',
  'Metalúrgica Pequena',
  'Fábrica de Embalagens',
  'Indústria de Esquadrias'
];

const SECTORS: Sector[] = ['Moveleiro', 'Vidro', 'Metal', 'Alimentos', 'Textil', 'Distribuicao', 'Embalagens'];

export const UPGRADES: UpgradeDefinition[] = [
  { id: 'stock', name: 'Organizar estoque', description: 'Reduz desperdício e custo mensal.', cost: 7000, effect: { costPct: -0.08, efficiency: 4, risk: -3 } },
  { id: 'machines', name: 'Trocar máquinas', description: 'Aumenta eficiência e receita.', cost: 18000, effect: { revenuePct: 0.1, efficiency: 8, quality: 3 } },
  { id: 'training', name: 'Treinar equipe', description: 'Aumenta eficiência e qualidade.', cost: 9000, effect: { efficiency: 6, quality: 5, risk: -2 } },
  { id: 'marketing', name: 'Campanha comercial', description: 'Aumenta demanda e receita.', cost: 11000, effect: { revenuePct: 0.14, demand: 9 } },
  { id: 'suppliers', name: 'Renegociar fornecedores', description: 'Reduz custo mensal.', cost: 8500, effect: { costPct: -0.1, risk: -1 } },
  { id: 'automation', name: 'Automatizar produção', description: 'Reduz custo e aumenta eficiência.', cost: 24000, effect: { costPct: -0.12, efficiency: 10, valuationMultiple: 1 } },
  { id: 'quality', name: 'Melhorar qualidade', description: 'Aumenta valuation, receita e reputação.', cost: 12000, effect: { revenuePct: 0.07, quality: 10, valuationMultiple: 1 } },
  { id: 'seller', name: 'Contratar vendedor', description: 'Aumenta receita e demanda.', cost: 10000, effect: { revenuePct: 0.12, demand: 7 } }
];

const MANAGER_TEMPLATES: Array<Omit<Manager, 'id' | 'assignedCompanyId'>> = [
  { name: 'Ana Operações', type: 'Operacional', rarity: 'Comum', salaryMonthly: 3500, bonus: { efficiency: 6 }, description: 'Melhora eficiência operacional.' },
  { name: 'Bruno Financeiro', type: 'Financeiro', rarity: 'Comum', salaryMonthly: 4200, bonus: { costPct: -0.06 }, description: 'Corta custos e renegocia despesas.' },
  { name: 'Carla Comercial', type: 'Comercial', rarity: 'Raro', salaryMonthly: 6200, bonus: { revenuePct: 0.08, demand: 5 }, description: 'Aumenta receita e demanda.' },
  { name: 'Diego Estoque', type: 'Estoque', rarity: 'Raro', salaryMonthly: 5200, bonus: { costPct: -0.04, risk: -5 }, description: 'Reduz desperdício e ruptura.' },
  { name: 'Helena CEO', type: 'CEO Profissional', rarity: 'Epico', salaryMonthly: 9800, bonus: { revenuePct: 0.06, costPct: -0.05, efficiency: 5, quality: 4, risk: -4 }, description: 'Melhora vários indicadores.' },
  { name: 'Marcos Turnaround', type: 'Turnaround', rarity: 'Epico', salaryMonthly: 8700, bonus: { costPct: -0.1, efficiency: 7, risk: -8 }, description: 'Excelente para empresas problemáticas.' },
  { name: 'Victoria Escala', type: 'Escala', rarity: 'Lendario', salaryMonthly: 14500, bonus: { revenuePct: 0.12, efficiency: 8, potential: 8 }, description: 'Transforma empresas lucrativas em máquinas de crescimento.' }
];

function id(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function money(value: number): string {
  return `${value < 0 ? '-R$ ' : 'R$ '}${Math.abs(Math.round(value)).toLocaleString('pt-BR')}`;
}

export function calculateValuation(company: Company): number {
  const profit = company.monthlyProfit;
  const assetBase = company.monthlyRevenue * (0.8 + company.quality / 140 + company.potential / 120);
  const riskPenalty = company.risk * 900;
  if (profit > 2500) {
    return Math.max(0, Math.round(profit * company.valuationMultiple + assetBase - company.debt - riskPenalty));
  }
  return Math.max(0, Math.round(assetBase * (0.32 + company.potential / 180) - company.debt - riskPenalty));
}

function recalc(company: Company): Company {
  company.efficiency = clamp(company.efficiency, 1, 100);
  company.quality = clamp(company.quality, 1, 100);
  company.demand = clamp(company.demand, 1, 100);
  company.risk = clamp(company.risk, 0, 100);
  company.potential = clamp(company.potential, 1, 100);
  company.monthlyProfit = Math.round(company.monthlyRevenue - company.monthlyCost - company.debt * 0.015);
  company.estimatedValue = calculateValuation(company);
  return company;
}

function makeCompany(index = 0, rare = false): Company {
  const sector = pick(SECTORS);
  const baseRevenue = rand(28000, 115000) * (rare ? rand(1.15, 1.65) : 1);
  const efficiency = rand(28, 72);
  const quality = rand(30, 78);
  const demand = rand(32, 82);
  const risk = rare ? rand(8, 32) : rand(18, 75);
  const potential = rare ? rand(68, 96) : rand(35, 92);
  const costRate = rand(0.72, 1.06) - efficiency / 420;
  const monthlyRevenue = Math.round(baseRevenue);
  const monthlyCost = Math.round(monthlyRevenue * clamp(costRate, 0.55, 1.12));
  const debt = Math.round(monthlyRevenue * rand(0.05, 0.55));
  const multiple = Math.round(rand(10, 24) + quality / 18 + potential / 20);
  const discount = rare ? 0.62 : rand(0.72, 1.05);
  const company: Company = {
    id: id('company'),
    name: COMPANY_NAMES[index % COMPANY_NAMES.length],
    sector,
    purchasePrice: 0,
    monthlyRevenue,
    monthlyCost,
    monthlyProfit: 0,
    efficiency: Math.round(efficiency),
    quality: Math.round(quality),
    demand: Math.round(demand),
    risk: Math.round(risk),
    debt,
    potential: Math.round(potential),
    valuationMultiple: multiple,
    estimatedValue: 0,
    upgradesApplied: [],
    managerId: null,
    rareOpportunity: rare
  };
  recalc(company);
  company.purchasePrice = Math.max(8000, Math.round(company.estimatedValue * discount));
  return company;
}

function createMarket(count = 6): Company[] {
  return Array.from({ length: count }, (_, index) => makeCompany(index, Math.random() < 0.16));
}

function createManagers(): Manager[] {
  return MANAGER_TEMPLATES.map((manager) => ({ ...manager, id: id('manager'), assignedCompanyId: null }));
}

export function freshHolding(): HoldingState {
  const state: HoldingState = {
    capital: 85000,
    month: 1,
    reputation: 1,
    activeTab: 'dashboard',
    market: createMarket(6),
    portfolio: [],
    managers: createManagers(),
    history: []
  };
  addHistory(state, 'Bem-vindo à holding', 'Compre empresas problemáticas, recupere a operação e venda ou mantenha ativos lucrativos.', 'neutral');
  return state;
}

export function loadHolding(): HoldingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshHolding();
    const parsed = JSON.parse(raw) as HoldingState;
    if (!Array.isArray(parsed.market) || !Array.isArray(parsed.portfolio)) return freshHolding();
    return parsed;
  } catch {
    return freshHolding();
  }
}

export function saveHolding(state: HoldingState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetHolding(): HoldingState {
  localStorage.removeItem(STORAGE_KEY);
  return freshHolding();
}

export function addHistory(state: HoldingState, title: string, description: string, impact: EventRecord['impact']): void {
  state.history.unshift({ id: id('event'), month: state.month, title, description, impact });
  state.history = state.history.slice(0, 30);
}

export function getMonthlyProfit(state: HoldingState): number {
  return state.portfolio.reduce((sum, company) => sum + company.monthlyProfit, 0) - state.managers.reduce((sum, manager) => sum + (manager.assignedCompanyId ? manager.salaryMonthly : 0), 0);
}

export function getTotalDebt(state: HoldingState): number {
  return state.portfolio.reduce((sum, company) => sum + company.debt, 0);
}

export function getHoldingValue(state: HoldingState): number {
  return state.capital + state.portfolio.reduce((sum, company) => sum + company.estimatedValue, 0);
}

export function buyCompany(state: HoldingState, companyId: string): void {
  const index = state.market.findIndex((company) => company.id === companyId);
  if (index < 0) return;
  const company = state.market[index];
  if (state.capital < company.purchasePrice) {
    addHistory(state, 'Capital insuficiente', `${company.name} custa ${money(company.purchasePrice)}.`, 'bad');
    return;
  }
  state.capital -= company.purchasePrice;
  state.portfolio.push(company);
  state.market.splice(index, 1);
  state.market.push(makeCompany(state.month + state.market.length));
  addHistory(state, 'Empresa comprada', `${company.name} comprada por ${money(company.purchasePrice)}.`, 'good');
  saveHolding(state);
}

export function sellCompany(state: HoldingState, companyId: string): void {
  const index = state.portfolio.findIndex((company) => company.id === companyId);
  if (index < 0) return;
  const company = state.portfolio[index];
  state.capital += company.estimatedValue;
  if (company.managerId) {
    const manager = state.managers.find((item) => item.id === company.managerId);
    if (manager) manager.assignedCompanyId = null;
  }
  state.portfolio.splice(index, 1);
  state.reputation += Math.max(1, Math.round(company.estimatedValue / 100000));
  addHistory(state, 'Empresa vendida', `${company.name} vendida por ${money(company.estimatedValue)}.`, company.estimatedValue >= company.purchasePrice ? 'good' : 'bad');
  saveHolding(state);
}

export function applyUpgrade(state: HoldingState, companyId: string, upgradeId: string): void {
  const company = state.portfolio.find((item) => item.id === companyId);
  const upgrade = UPGRADES.find((item) => item.id === upgradeId);
  if (!company || !upgrade) return;
  if (company.upgradesApplied.includes(upgrade.id)) return;
  if (state.capital < upgrade.cost) {
    addHistory(state, 'Capital insuficiente', `Upgrade ${upgrade.name} custa ${money(upgrade.cost)}.`, 'bad');
    return;
  }
  state.capital -= upgrade.cost;
  applyEffect(company, upgrade.effect);
  company.upgradesApplied.push(upgrade.id);
  recalc(company);
  addHistory(state, 'Upgrade aplicado', `${upgrade.name} aplicado em ${company.name}.`, 'good');
  saveHolding(state);
}

function applyEffect(company: Company, effect: UpgradeEffect | ManagerBonus): void {
  if (effect.revenuePct) company.monthlyRevenue = Math.round(company.monthlyRevenue * (1 + effect.revenuePct));
  if (effect.costPct) company.monthlyCost = Math.round(company.monthlyCost * (1 + effect.costPct));
  if (effect.efficiency) company.efficiency += effect.efficiency;
  if (effect.quality) company.quality += effect.quality;
  if (effect.demand) company.demand += effect.demand;
  if (effect.risk) company.risk += effect.risk;
  if (effect.potential) company.potential += effect.potential;
  if ('valuationMultiple' in effect && effect.valuationMultiple) company.valuationMultiple += effect.valuationMultiple;
}

export function assignManager(state: HoldingState, managerId: string, companyId: string): void {
  const manager = state.managers.find((item) => item.id === managerId);
  const company = state.portfolio.find((item) => item.id === companyId);
  if (!manager || !company) return;
  if (manager.assignedCompanyId && manager.assignedCompanyId !== companyId) {
    addHistory(state, 'Manager ocupado', `${manager.name} já está atribuído a outra empresa.`, 'bad');
    return;
  }
  if (company.managerId && company.managerId !== managerId) {
    const old = state.managers.find((item) => item.id === company.managerId);
    if (old) old.assignedCompanyId = null;
  }
  manager.assignedCompanyId = company.id;
  company.managerId = manager.id;
  addHistory(state, 'Manager atribuído', `${manager.name} agora lidera ${company.name}.`, 'good');
  saveHolding(state);
}

export function hireManager(state: HoldingState, managerId: string): void {
  const manager = state.managers.find((item) => item.id === managerId);
  if (!manager) return;
  const signingCost = manager.salaryMonthly * 2;
  if (state.capital < signingCost) {
    addHistory(state, 'Capital insuficiente', `Contratar ${manager.name} exige ${money(signingCost)}.`, 'bad');
    return;
  }
  state.capital -= signingCost;
  addHistory(state, 'Manager contratado', `${manager.name} entrou para o time. Custo inicial: ${money(signingCost)}.`, 'good');
  saveHolding(state);
}

function managerEffect(company: Company, manager: Manager): void {
  const beforeRevenue = company.monthlyRevenue;
  const beforeCost = company.monthlyCost;
  applyEffect(company, manager.bonus);
  if (manager.type === 'Turnaround' && company.monthlyProfit < 0) {
    company.monthlyCost = Math.round(company.monthlyCost * 0.94);
    company.risk -= 4;
  }
  if (manager.type === 'Escala' && company.monthlyProfit > 8000) {
    company.monthlyRevenue = Math.round(company.monthlyRevenue * 1.04);
    company.potential += 2;
  }
  company.monthlyRevenue = Math.round((company.monthlyRevenue + beforeRevenue * 3) / 4);
  company.monthlyCost = Math.round((company.monthlyCost + beforeCost * 3) / 4);
}

export function passMonth(state: HoldingState): void {
  state.month += 1;
  let net = 0;
  for (const company of state.portfolio) {
    const manager = company.managerId ? state.managers.find((item) => item.id === company.managerId) : null;
    if (manager) managerEffect(company, manager);
    const noise = rand(0.94, 1.07);
    const riskCost = company.risk > 70 && Math.random() < 0.2 ? company.monthlyRevenue * 0.06 : 0;
    company.monthlyRevenue = Math.round(company.monthlyRevenue * noise * (1 + (company.demand - 50) / 900));
    company.monthlyCost = Math.round(company.monthlyCost * rand(0.98, 1.04) + riskCost);
    recalc(company);
    net += company.monthlyProfit;
  }
  const salaries = state.managers.reduce((sum, manager) => sum + (manager.assignedCompanyId ? manager.salaryMonthly : 0), 0);
  net -= salaries;
  state.capital += net;
  triggerRandomEvent(state);
  for (const company of state.portfolio) recalc(company);
  addHistory(state, 'Mês fechado', `Resultado líquido da holding: ${money(net)}. Salários de managers: ${money(salaries)}.`, net >= 0 ? 'good' : 'bad');
  if (Math.random() < 0.35) state.market.push(makeCompany(state.month + state.market.length, Math.random() < 0.28));
  state.market = state.market.slice(-8);
  saveHolding(state);
}

function triggerRandomEvent(state: HoldingState): void {
  if (Math.random() > 0.62) return;
  const target = state.portfolio.length ? pick(state.portfolio) : null;
  const roll = Math.random();
  if (!target || roll < 0.14) {
    const company = makeCompany(state.month, true);
    state.market.unshift(company);
    addHistory(state, 'Oportunidade rara', `${company.name} apareceu barata no mercado.`, 'good');
    return;
  }
  if (roll < 0.28) {
    target.demand -= 8;
    target.monthlyRevenue = Math.round(target.monthlyRevenue * 0.92);
    addHistory(state, 'Crise no setor', `${target.sector} sofreu queda de demanda. ${target.name} perdeu receita.`, 'bad');
  } else if (roll < 0.42) {
    target.monthlyRevenue = Math.round(target.monthlyRevenue * 1.12);
    target.demand += 6;
    addHistory(state, 'Boom econômico', `${target.name} vendeu mais com o mercado aquecido.`, 'good');
  } else if (roll < 0.56) {
    target.efficiency -= 8;
    target.monthlyCost = Math.round(target.monthlyCost * 1.08);
    addHistory(state, 'Máquina quebrou', `${target.name} perdeu eficiência e teve aumento de custos.`, 'bad');
  } else if (roll < 0.7) {
    target.monthlyCost = Math.round(target.monthlyCost * 1.08);
    addHistory(state, 'Fornecedor aumentou preço', `${target.name} teve pressão nos custos.`, 'bad');
  } else if (roll < 0.84) {
    target.demand += 10;
    target.monthlyRevenue = Math.round(target.monthlyRevenue * 1.1);
    addHistory(state, 'Produto viralizou', `${target.name} ganhou demanda repentina.`, 'good');
  } else {
    const fine = target.risk > 55 ? Math.round(target.risk * 220) : 0;
    state.capital -= fine;
    addHistory(state, 'Fiscalização', fine ? `${target.name} pagou multa de ${money(fine)} por risco alto.` : `${target.name} passou pela fiscalização sem multa.`, fine ? 'bad' : 'neutral');
  }
  recalc(target);
}
