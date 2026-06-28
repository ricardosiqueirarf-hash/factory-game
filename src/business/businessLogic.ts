import { BusinessStateData, CommercialStrategyKey, CompanyKind, FounderState, MaterialKey, MaterialState, MonthResult } from './businessTypes';
import { evaluateFormula, FormulaVariables } from './formulaEngine';

const STORAGE_KEY = 'factory-idle-business-v1';

const MATERIAL_NAMES: Record<MaterialKey, string> = {
  aluminum: 'Aluminio',
  glass: 'Vidro',
  hardware: 'Ferragens',
  raw_wood: 'Madeira bruta',
  glue: 'Cola',
  varnish: 'Verniz'
};

const MATERIAL_UNITS: Record<MaterialKey, string> = {
  aluminum: 'm',
  glass: 'm2',
  hardware: 'kit',
  raw_wood: 'm3',
  glue: 'kg',
  varnish: 'L'
};

const PRODUCT_CONFIG: Record<CompanyKind, { name: string; basePrice: number; unitRevenue: number; unitVariableCost: number; fixedCost: number; materials: Array<{ key: MaterialKey; unitCost: number; stock: number; monthlyFlow: number; perUnit: number }> }> = {
  doors_factory: {
    name: 'Fabrica de portas',
    basePrice: 32000,
    unitRevenue: 520,
    unitVariableCost: 110,
    fixedCost: 5200,
    materials: [
      { key: 'aluminum', unitCost: 42, stock: 180, monthlyFlow: 120, perUnit: 4 },
      { key: 'glass', unitCost: 85, stock: 55, monthlyFlow: 36, perUnit: 1.2 },
      { key: 'hardware', unitCost: 18, stock: 90, monthlyFlow: 60, perUnit: 1 }
    ]
  },
  sawmill: {
    name: 'Madereira',
    basePrice: 26000,
    unitRevenue: 290,
    unitVariableCost: 70,
    fixedCost: 3900,
    materials: [
      { key: 'raw_wood', unitCost: 720, stock: 42, monthlyFlow: 28, perUnit: 0.35 },
      { key: 'glue', unitCost: 22, stock: 80, monthlyFlow: 48, perUnit: 0.65 },
      { key: 'varnish', unitCost: 35, stock: 70, monthlyFlow: 42, perUnit: 0.5 }
    ]
  }
};

function createFounder(founder?: Partial<FounderState>): FounderState {
  return {
    capital: Number(founder?.capital ?? 60000),
    soldCompanies: Number(founder?.soldCompanies ?? 0),
    managedCompanies: Number(founder?.managedCompanies ?? 0),
    lastExitValue: Number(founder?.lastExitValue ?? 0)
  };
}

export function createFreshBusiness(kind: CompanyKind | null = null, founder?: FounderState, scale = 1): BusinessStateData {
  const chosen = kind ?? null;
  const config = chosen ? PRODUCT_CONFIG[chosen] : PRODUCT_CONFIG.doors_factory;
  const size = Math.max(1, Math.round(scale));
  return {
    companyKind: chosen,
    companyScale: size,
    hasGeneralManager: false,
    month: 1,
    elapsedSeconds: 0,
    materials: config.materials.map((material) => ({
      key: material.key,
      name: MATERIAL_NAMES[material.key],
      unit: MATERIAL_UNITS[material.key],
      stock: Math.round(material.stock * size),
      unitCost: material.unitCost,
      monthlyFlow: Math.round(material.monthlyFlow * size),
      demandVariation: 1,
      reorderFormula: '=SE(ESTOQUE < VAZAO * 1.5; 1; 0)',
      quantityFormula: '=MAX(0; VAZAO * 2 - ESTOQUE)',
      purchasedMonth: 0,
      rupturesMonth: 0,
      idleStockCost: 0
    })),
    indicators: [
      { id: 'coverage', name: 'COBERTURA', formula: '=ESTOQUE / MAX(1; VAZAO)', value: 0 },
      { id: 'need', name: 'NECESSIDADE', formula: '=MAX(0; VAZAO * 2 - ESTOQUE)', value: 0 }
    ],
    commercial: {
      baseDemand: Math.round((chosen === 'sawmill' ? 34 : 42) * size),
      salesCapacity: Math.round((chosen === 'sawmill' ? 36 : 46) * size),
      sellers: Math.max(1, size),
      marketingLevel: 0,
      trainingLevel: 0,
      salesFocus: 1
    },
    financials: {
      cash: Math.round(18000 * size),
      revenueMonth: 0,
      lostRevenueMonth: 0,
      purchasesMonth: 0,
      stockHoldingCostMonth: 0,
      commercialCostMonth: 0,
      fixedCostMonth: 0,
      grossMarginMonth: 0,
      resultMonth: 0,
      totalRevenue: 0,
      totalResult: 0
    },
    founder: createFounder(founder),
    selectedDepartment: 'logistics',
    lastMessage: chosen ? `Empresa comprada: ${config.name} porte ${size}.` : 'Escolha uma empresa para comprar.'
  };
}

export function loadBusiness(): BusinessStateData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createFreshBusiness(null);
    const parsed = JSON.parse(raw) as Partial<BusinessStateData>;
    const loaded = createFreshBusiness(parsed.companyKind ?? null, createFounder(parsed.founder), parsed.companyScale ?? 1);
    return {
      ...loaded,
      ...parsed,
      companyScale: Number(parsed.companyScale ?? loaded.companyScale),
      hasGeneralManager: Boolean(parsed.hasGeneralManager ?? false),
      founder: createFounder(parsed.founder),
      materials: Array.isArray(parsed.materials) ? parsed.materials : loaded.materials,
      indicators: Array.isArray(parsed.indicators) ? parsed.indicators : loaded.indicators,
      commercial: parsed.commercial ?? loaded.commercial,
      financials: parsed.financials ?? loaded.financials,
      selectedDepartment: parsed.selectedDepartment ?? 'logistics',
      lastMessage: parsed.lastMessage ?? loaded.lastMessage
    };
  } catch {
    return createFreshBusiness(null);
  }
}

export function saveBusiness(state: BusinessStateData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetBusiness(): BusinessStateData {
  localStorage.removeItem(STORAGE_KEY);
  return createFreshBusiness(null);
}

export function getCompanyPurchasePrice(kind: CompanyKind, scale: number): number {
  return Math.round(PRODUCT_CONFIG[kind].basePrice * Math.pow(scale, 1.42));
}

export function getNextAffordableScale(founder: FounderState): number {
  const base = Math.max(1, founder.soldCompanies + founder.managedCompanies + 1);
  return Math.min(12, base);
}

export function chooseCompany(kind: CompanyKind, current?: BusinessStateData, scale = getNextAffordableScale(current?.founder ?? createFounder())): BusinessStateData {
  const founder = createFounder(current?.founder);
  const price = getCompanyPurchasePrice(kind, scale);
  if (founder.capital < price) {
    const state = createFreshBusiness(null, founder);
    state.lastMessage = `Capital insuficiente. Essa empresa custa ${formatMoney(price)}.`;
    saveBusiness(state);
    return state;
  }

  founder.capital -= price;
  const state = createFreshBusiness(kind, founder, scale);
  state.lastMessage = `${PRODUCT_CONFIG[kind].name} comprada por ${formatMoney(price)}. Agora opere manualmente mes a mes.`;
  saveBusiness(state);
  return state;
}

export function getCompanyName(kind: CompanyKind | null): string {
  if (!kind) return 'Sem empresa';
  return PRODUCT_CONFIG[kind].name;
}

export function getMaterialVariables(state: BusinessStateData, material: MaterialState): FormulaVariables {
  const variables: FormulaVariables = {
    ESTOQUE: material.stock,
    VAZAO: material.monthlyFlow,
    DEMANDA: getCommercialDemand(state),
    CAIXA: state.financials.cash,
    CAPITAL: state.founder.capital,
    CUSTO: material.unitCost,
    MES: state.month,
    COMPRA_MES: material.purchasedMonth,
    RUPTURA: material.rupturesMonth,
    PORTE: state.companyScale
  };

  for (const indicator of state.indicators) {
    variables[indicator.name.toUpperCase()] = Number(indicator.value) || 0;
  }

  return variables;
}

export function recalculateIndicators(state: BusinessStateData): void {
  const reference = state.materials[0];
  const baseVariables = reference ? getMaterialVariables(state, reference) : { ESTOQUE: 0, VAZAO: 0, DEMANDA: 0, CAIXA: state.financials.cash, CAPITAL: state.founder.capital, CUSTO: 0, MES: state.month, PORTE: state.companyScale };
  for (const indicator of state.indicators) {
    const result = evaluateFormula(indicator.formula, baseVariables);
    indicator.value = result.value;
    indicator.error = result.error;
    baseVariables[indicator.name.toUpperCase()] = result.value;
  }
}

export function runMonth(state: BusinessStateData): MonthResult {
  if (!state.companyKind) {
    return { month: state.month, demandedUnits: 0, fulfilledUnits: 0, lostUnits: 0, revenue: 0, lostRevenue: 0, purchases: 0, result: 0 };
  }

  const config = PRODUCT_CONFIG[state.companyKind];
  state.month += 1;
  state.elapsedSeconds = 0;
  recalculateIndicators(state);

  let purchases = 0;
  for (const material of state.materials) {
    material.demandVariation = randomBetween(0.75, 1.35);
    material.monthlyFlow = Math.max(1, Math.round(material.monthlyFlow * randomBetween(0.86, 1.16)));
    const variables = getMaterialVariables(state, material);
    const shouldBuy = evaluateFormula(material.reorderFormula, variables).value > 0;
    const quantity = Math.max(0, Math.round(evaluateFormula(material.quantityFormula, variables).value));
    material.purchasedMonth = shouldBuy ? quantity : 0;
    if (shouldBuy && quantity > 0) {
      const cost = quantity * material.unitCost;
      purchases += cost;
      material.stock += quantity;
    }
  }

  const demandedUnits = Math.round(getCommercialDemand(state) * randomBetween(0.86, 1.22));
  const salesCapacity = getCommercialCapacity(state);
  const possibleByStock = getPossibleUnitsByStock(state);
  const fulfilledUnits = Math.max(0, Math.min(demandedUnits, salesCapacity, possibleByStock));
  const lostUnits = Math.max(0, demandedUnits - fulfilledUnits);
  consumeMaterialsForUnits(state, fulfilledUnits);

  const revenue = fulfilledUnits * config.unitRevenue;
  const lostRevenue = lostUnits * config.unitRevenue;
  const variableCost = fulfilledUnits * config.unitVariableCost;
  const commercialCost = getCommercialCost(state);
  const stockHoldingCost = state.materials.reduce((total, material) => {
    const target = Math.max(1, material.monthlyFlow * 1.8);
    const excess = Math.max(0, material.stock - target);
    material.idleStockCost = excess * material.unitCost * 0.025;
    return total + material.idleStockCost;
  }, 0);
  const fixedCost = config.fixedCost * state.companyScale + state.commercial.sellers * 950 + (state.hasGeneralManager ? 8500 : 0);
  const grossMargin = revenue - variableCost - purchases;
  const result = revenue - variableCost - purchases - commercialCost - stockHoldingCost - fixedCost;

  for (const material of state.materials) {
    material.rupturesMonth = lostUnits > 0 ? Math.max(0, demandedUnits - possibleByStock) : 0;
  }

  state.financials.cash += result;
  state.financials.revenueMonth = revenue;
  state.financials.lostRevenueMonth = lostRevenue;
  state.financials.purchasesMonth = purchases;
  state.financials.stockHoldingCostMonth = stockHoldingCost;
  state.financials.commercialCostMonth = commercialCost;
  state.financials.fixedCostMonth = fixedCost;
  state.financials.grossMarginMonth = grossMargin;
  state.financials.resultMonth = result;
  state.financials.totalRevenue += revenue;
  state.financials.totalResult += result;
  state.lastMessage = lostUnits > 0 ? `Mes ${state.month}: ruptura! ${lostUnits} pedidos perdidos.` : `Mes ${state.month}: atendido sem ruptura.`;

  saveBusiness(state);
  return { month: state.month, demandedUnits, fulfilledUnits, lostUnits, revenue, lostRevenue, purchases, result };
}

export function canHireGeneralManager(state: BusinessStateData): boolean {
  const margin = state.financials.revenueMonth > 0 ? state.financials.resultMonth / state.financials.revenueMonth : 0;
  return Boolean(state.companyKind && !state.hasGeneralManager && state.month >= 6 && state.financials.cash >= 80000 && state.financials.resultMonth >= 12000 && margin >= 0.15);
}

export function hireGeneralManager(state: BusinessStateData): string {
  if (!canHireGeneralManager(state)) return 'Ainda nao da para contratar gerente geral. Busque caixa, margem e lucro mensal mais consistentes.';
  state.hasGeneralManager = true;
  state.founder.managedCompanies += 1;
  state.founder.capital += Math.round(state.financials.cash * 0.35);
  state.financials.cash = Math.round(state.financials.cash * 0.65);
  state.lastMessage = 'Gerente geral contratado. A empresa virou ativo gerenciado e parte do caixa foi liberada para o fundador.';
  saveBusiness(state);
  return state.lastMessage;
}

export function getCompanyValuation(state: BusinessStateData): number {
  if (!state.companyKind) return 0;
  const averageRevenue = state.month > 1 ? state.financials.totalRevenue / Math.max(1, state.month - 1) : state.financials.revenueMonth;
  const averageResult = state.month > 1 ? state.financials.totalResult / Math.max(1, state.month - 1) : state.financials.resultMonth;
  const stockValue = state.materials.reduce((total, material) => total + material.stock * material.unitCost, 0);
  const resultMultiple = Math.max(0, averageResult) * 18;
  const revenueMultiple = averageRevenue * 1.2;
  return Math.max(0, Math.round(state.financials.cash + stockValue * 0.55 + resultMultiple + revenueMultiple));
}

export function sellCompany(state: BusinessStateData): BusinessStateData {
  const founder = createFounder(state.founder);
  const valuation = getCompanyValuation(state);
  founder.capital += valuation;
  founder.soldCompanies += 1;
  founder.lastExitValue = valuation;
  const next = createFreshBusiness(null, founder, getNextAffordableScale(founder));
  next.lastMessage = `Empresa vendida por ${formatMoney(valuation)}. Capital do fundador: ${formatMoney(founder.capital)}. Compre uma empresa maior.`;
  saveBusiness(next);
  return next;
}

export function applyCommercialStrategy(state: BusinessStateData, strategy: CommercialStrategyKey): string {
  const financials = state.financials;
  if (strategy === 'hire_seller') {
    const cost = 3500 * Math.max(1, state.companyScale * 0.7);
    if (financials.cash < cost) return 'Caixa insuficiente para contratar vendedor.';
    financials.cash -= cost;
    state.commercial.sellers += 1;
    state.commercial.salesCapacity += 14;
    return 'Vendedor contratado. Capacidade comercial aumentou, mas a folha mensal tambem subiu.';
  }
  if (strategy === 'marketing') {
    const cost = 2200 + state.commercial.marketingLevel * 900;
    if (financials.cash < cost) return 'Caixa insuficiente para marketing.';
    financials.cash -= cost;
    state.commercial.marketingLevel += 1;
    state.commercial.baseDemand += 8 * state.companyScale;
    return 'Campanha de marketing ativa. Demanda media aumentou.';
  }
  if (strategy === 'training') {
    const cost = 1800 + state.commercial.trainingLevel * 700;
    if (financials.cash < cost) return 'Caixa insuficiente para treinamento.';
    financials.cash -= cost;
    state.commercial.trainingLevel += 1;
    state.commercial.salesCapacity += 7;
    return 'Treinamento aplicado. Conversao e capacidade comercial melhoraram.';
  }
  const cost = 900;
  if (financials.cash < cost) return 'Caixa insuficiente para realocar equipe.';
  financials.cash -= cost;
  state.commercial.salesFocus = Math.min(1.8, state.commercial.salesFocus + 0.12);
  state.commercial.baseDemand += 3 * state.companyScale;
  return 'Equipe realocada para vendas. A empresa ficou mais agressiva comercialmente.';
}

function getCommercialDemand(state: BusinessStateData): number {
  return Math.max(0, state.commercial.baseDemand * (1 + state.commercial.marketingLevel * 0.08) * state.commercial.salesFocus);
}

function getCommercialCapacity(state: BusinessStateData): number {
  return Math.max(0, state.commercial.salesCapacity + state.commercial.trainingLevel * 3 + state.commercial.sellers * 4);
}

function getCommercialCost(state: BusinessStateData): number {
  return state.commercial.marketingLevel * 1200 + state.commercial.trainingLevel * 380 + Math.max(0, state.commercial.salesFocus - 1) * 1600;
}

function getPossibleUnitsByStock(state: BusinessStateData): number {
  if (!state.companyKind) return 0;
  const config = PRODUCT_CONFIG[state.companyKind];
  return Math.floor(Math.min(...config.materials.map((materialConfig) => {
    const material = state.materials.find((item) => item.key === materialConfig.key);
    return material ? material.stock / materialConfig.perUnit : 0;
  })));
}

function consumeMaterialsForUnits(state: BusinessStateData, units: number): void {
  if (!state.companyKind || units <= 0) return;
  const config = PRODUCT_CONFIG[state.companyKind];
  for (const materialConfig of config.materials) {
    const material = state.materials.find((item) => item.key === materialConfig.key);
    if (material) material.stock = Math.max(0, material.stock - units * materialConfig.perUnit);
  }
}

function formatMoney(value: number): string {
  return `R$ ${Math.round(value).toLocaleString('pt-BR')}`;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
