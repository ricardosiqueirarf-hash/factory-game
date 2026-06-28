import { evaluateFormula } from './formulaEngine';
import { CompanyQuarterReport, PortfolioCompany, PortfolioMaterial, PortfolioState } from './portfolioTypes';

const STORAGE_KEY = 'factory-portfolio-v1';
const BASE_REVENUE = 50000;
const MANAGER_RATE = 0.07;
const MANAGER_MIN_MARGIN = 0.07;

function id(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function money(value: number): string {
  return `${value < 0 ? '-R$ ' : 'R$ '}${Math.abs(Math.round(value)).toLocaleString('pt-BR')}`;
}

export function getAverageRevenue(level: number): number {
  return BASE_REVENUE * level;
}

export function getManagerSalary(level: number): number {
  return getAverageRevenue(level) * MANAGER_RATE;
}

export function getCompanyPrice(level: number): number {
  return Math.round(getAverageRevenue(level) * 2.4);
}

function createMaterials(level: number): PortfolioMaterial[] {
  return [
    { name: 'Materia-prima principal', unit: 'un', stock: 150 * level, monthlyFlow: 100 * level, unitCost: 85, perOrder: 3, reorderFormula: '=SE(ESTOQUE < VAZAO * 1.4; 1; 0)', quantityFormula: '=MAX(0; VAZAO * 2 - ESTOQUE)' },
    { name: 'Insumo auxiliar', unit: 'un', stock: 90 * level, monthlyFlow: 60 * level, unitCost: 34, perOrder: 2, reorderFormula: '=SE(ESTOQUE < VAZAO * 1.2; 1; 0)', quantityFormula: '=MAX(0; VAZAO * 1.8 - ESTOQUE)' },
    { name: 'Embalagem / ferragem', unit: 'kit', stock: 70 * level, monthlyFlow: 50 * level, unitCost: 22, perOrder: 1, reorderFormula: '=SE(ESTOQUE < VAZAO; 1; 0)', quantityFormula: '=MAX(0; VAZAO * 1.5 - ESTOQUE)' }
  ];
}

export function createCompany(level: number, status: 'player' | 'manager' = 'player'): PortfolioCompany {
  const averageRevenue = getAverageRevenue(level);
  return {
    id: id(),
    name: `Empresa nivel ${level}`,
    level,
    status,
    month: 1,
    quarter: 1,
    averageRevenue,
    cash: Math.round(averageRevenue * 0.35),
    revenueMonth: 0,
    expensesMonth: 0,
    profitMonth: 0,
    marginMonth: 0,
    lostRevenueMonth: 0,
    managerSalary: getManagerSalary(level),
    materials: createMaterials(level),
    reports: []
  };
}

export function freshPortfolio(): PortfolioState {
  const company = createCompany(1, 'player');
  return {
    founderCapital: 0,
    companies: [company],
    selectedCompanyId: company.id,
    maxUnlockedLevel: 1,
    message: 'Carteira iniciada com 1 empresa nivel 1. Fature, proteja margem e contrate um manager.'
  };
}

export function loadPortfolio(): PortfolioState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshPortfolio();
    const parsed = JSON.parse(raw) as PortfolioState;
    if (!Array.isArray(parsed.companies) || parsed.companies.length === 0) return freshPortfolio();
    return parsed;
  } catch {
    return freshPortfolio();
  }
}

export function savePortfolio(state: PortfolioState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetPortfolio(): PortfolioState {
  localStorage.removeItem(STORAGE_KEY);
  return freshPortfolio();
}

export function getSelectedCompany(state: PortfolioState): PortfolioCompany {
  return state.companies.find((company) => company.id === state.selectedCompanyId) ?? state.companies[0];
}

function materialVars(company: PortfolioCompany, material: PortfolioMaterial): Record<string, number> {
  return {
    ESTOQUE: material.stock,
    VAZAO: material.monthlyFlow,
    FATURAMENTO: company.averageRevenue,
    CAIXA: company.cash,
    CUSTO: material.unitCost,
    MES: company.month,
    NIVEL: company.level,
    MARGEM: company.marginMonth
  };
}

export function simulatePlayerMonth(company: PortfolioCompany): void {
  let purchases = 0;
  let stockLimiter = Infinity;

  for (const material of company.materials) {
    material.monthlyFlow = Math.max(1, Math.round(material.monthlyFlow * (0.88 + Math.random() * 0.24)));
    const shouldBuy = evaluateFormula(material.reorderFormula, materialVars(company, material)).value > 0;
    const qty = Math.max(0, Math.round(evaluateFormula(material.quantityFormula, materialVars(company, material)).value));
    if (shouldBuy && qty > 0) {
      material.stock += qty;
      purchases += qty * material.unitCost;
    }
    stockLimiter = Math.min(stockLimiter, material.stock / material.perOrder);
  }

  const demandFactor = 0.88 + Math.random() * 0.24;
  const potentialRevenue = company.averageRevenue * demandFactor;
  const possibleRevenue = Math.min(potentialRevenue, stockLimiter * (company.averageRevenue / Math.max(1, company.materials[0].monthlyFlow / company.materials[0].perOrder)));
  const revenue = Math.max(0, Math.round(possibleRevenue));
  const lostRevenue = Math.max(0, Math.round(potentialRevenue - revenue));
  const materialUseRatio = potentialRevenue > 0 ? revenue / potentialRevenue : 0;

  for (const material of company.materials) {
    material.stock = Math.max(0, material.stock - material.monthlyFlow * materialUseRatio);
  }

  const variableCost = revenue * 0.52;
  const fixedCost = company.averageRevenue * 0.28;
  const expenses = Math.round(variableCost + fixedCost + purchases);
  const profit = Math.round(revenue - expenses);

  company.cash += profit;
  company.month += 1;
  company.revenueMonth = revenue;
  company.expensesMonth = expenses;
  company.profitMonth = profit;
  company.marginMonth = revenue > 0 ? profit / revenue : 0;
  company.lostRevenueMonth = lostRevenue;
}

export function canHireManager(company: PortfolioCompany): boolean {
  return company.status === 'player' && company.profitMonth > company.managerSalary && company.marginMonth >= MANAGER_MIN_MARGIN;
}

export function hireManager(state: PortfolioState, company: PortfolioCompany): void {
  if (!canHireManager(company)) {
    state.message = `Manager bloqueado: lucro mensal precisa ser maior que ${money(company.managerSalary)} e margem precisa ser pelo menos 7%.`;
    return;
  }
  company.status = 'manager';
  state.maxUnlockedLevel = Math.max(state.maxUnlockedLevel, company.level + 1);
  state.message = `Manager contratado na ${company.name}. Ele automatiza a operacao e liberou empresas nivel ${company.level + 1}.`;
}

export function buyNextCompany(state: PortfolioState): void {
  const level = state.maxUnlockedLevel;
  const hasPlayerCompany = state.companies.some((company) => company.status === 'player');
  if (hasPlayerCompany) {
    state.message = 'Voce ja tem uma empresa sem manager. Contrate manager antes de abrir outra.';
    return;
  }
  const price = getCompanyPrice(level);
  if (state.founderCapital < price) {
    state.message = `Capital insuficiente. Empresa nivel ${level} custa ${money(price)}.`;
    return;
  }
  state.founderCapital -= price;
  const company = createCompany(level, 'player');
  state.companies.push(company);
  state.selectedCompanyId = company.id;
  state.message = `Nova empresa nivel ${level} comprada por ${money(price)}.`;
}

export function simulateManagedQuarter(state: PortfolioState): void {
  const managed = state.companies.filter((company) => company.status === 'manager');
  if (managed.length === 0) {
    state.message = 'Nenhuma empresa com manager para fechar trimestre.';
    return;
  }
  let totalDistributed = 0;
  for (const company of managed) {
    let revenue = 0;
    let expenses = 0;
    let profit = 0;
    for (let i = 0; i < 3; i += 1) {
      const r = company.averageRevenue * (0.9 + Math.random() * 0.2);
      const managerQuality = 0.94 + Math.random() * 0.1;
      const e = r * (0.87 - Math.min(0.08, company.level * 0.01)) * managerQuality + company.managerSalary;
      revenue += r;
      expenses += e;
      profit += r - e;
      company.month += 1;
    }
    const cashDistributed = Math.max(0, Math.round(profit * 0.65));
    totalDistributed += cashDistributed;
    company.cash += Math.round(profit - cashDistributed);
    company.revenueMonth = Math.round(revenue / 3);
    company.expensesMonth = Math.round(expenses / 3);
    company.profitMonth = Math.round(profit / 3);
    company.marginMonth = revenue > 0 ? profit / revenue : 0;
    company.quarter += 1;
    const report: CompanyQuarterReport = {
      quarter: company.quarter,
      revenue: Math.round(revenue),
      expenses: Math.round(expenses),
      managerSalary: company.managerSalary * 3,
      profit: Math.round(profit),
      margin: revenue > 0 ? profit / revenue : 0,
      cashDistributed
    };
    company.reports.unshift(report);
    company.reports = company.reports.slice(0, 4);
  }
  state.founderCapital += totalDistributed;
  state.message = `DRE trimestral recebida. Distribuicao total ao fundador: ${money(totalDistributed)}.`;
}
