import { BusinessStateData, CommercialStrategyKey, CompanyKind, IndicatorDefinition, MaterialKey, MaterialState, MonthResult } from './businessTypes';
import { evaluateFormula, FormulaVariables } from './formulaEngine';

const STORAGE_KEY = 'factory-idle-business-v1';
const MONTH_SECONDS = 18;

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

const PRODUCT_CONFIG: Record<CompanyKind, { name: string; unitRevenue: number; unitVariableCost: number; fixedCost: number; materials: Array<{ key: MaterialKey; unitCost: number; stock: number; monthlyFlow: number; perUnit: number }> }> = {
  doors_factory: {
    name: 'Fabrica de portas',
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

export function createFreshBusiness(kind: CompanyKind | null = null): BusinessStateData {
  const chosen = kind ?? null;
  const config = chosen ? PRODUCT_CONFIG[chosen] : PRODUCT_CONFIG.doors_factory;
  return {
    companyKind: chosen,
    month: 1,
    elapsedSeconds: 0,
    materials: config.materials.map((material) => ({
      key: material.key,
      name: MATERIAL_NAMES[material.key],
      unit: MATERIAL_UNITS[material.key],
      stock: material.stock,
      unitCost: material.unitCost,
      monthlyFlow: material.monthlyFlow,
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
      baseDemand: chosen === 'sawmill' ? 34 : 42,
      salesCapacity: chosen === 'sawmill' ? 36 : 46,
      sellers: 1,
      marketingLevel: 0,
      trainingLevel: 0,
      salesFocus: 1
    },
    financials: {
      cash: 45000,
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
    selectedDepartment: 'logistics',
    lastMessage: chosen ? `Empresa iniciada: ${config.name}` : 'Escolha uma empresa para iniciar o simulador.'
  };
}

export function loadBusiness(): BusinessStateData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createFreshBusiness(null);
    const parsed = JSON.parse(raw) as BusinessStateData;
    if (!parsed.companyKind) return createFreshBusiness(null);
    return parsed;
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

export function chooseCompany(kind: CompanyKind): BusinessStateData {
  const state = createFreshBusiness(kind);
  saveBusiness(state);
  return state;
}

export function getCompanyName(kind: CompanyKind | null): string {
  if (!kind) return 'Sem empresa';
  return PRODUCT_CONFIG[kind].name;
}

export function getMonthSeconds(): number {
  return MONTH_SECONDS;
}

export function getMaterialVariables(state: BusinessStateData, material: MaterialState): FormulaVariables {
  const variables: FormulaVariables = {
    ESTOQUE: material.stock,
    VAZAO: material.monthlyFlow,
    DEMANDA: getCommercialDemand(state),
    CAIXA: state.financials.cash,
    CUSTO: material.unitCost,
    MES: state.month,
    COMPRA_MES: material.purchasedMonth,
    RUPTURA: material.rupturesMonth
  };

  for (const indicator of state.indicators) {
    variables[indicator.name.toUpperCase()] = Number(indicator.value) || 0;
  }

  return variables;
}

export function recalculateIndicators(state: BusinessStateData): void {
  const reference = state.materials[0];
  const baseVariables = reference ? getMaterialVariables(state, reference) : { ESTOQUE: 0, VAZAO: 0, DEMANDA: 0, CAIXA: state.financials.cash, CUSTO: 0, MES: state.month };
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

  const demand = getCommercialDemand(state);
  const salesCapacity = getCommercialCapacity(state);
  const demandedUnits = Math.round(demand * randomBetween(0.86, 1.22));
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
  const fixedCost = config.fixedCost + state.commercial.sellers * 950;
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
  state.lastMessage = lostUnits > 0
    ? `Mes ${state.month}: ruptura! ${lostUnits} pedidos perdidos por estoque/capacidade.`
    : `Mes ${state.month}: operacao atendida sem ruptura.`;

  saveBusiness(state);
  return { month: state.month, demandedUnits, fulfilledUnits, lostUnits, revenue, lostRevenue, purchases, result };
}

export function applyCommercialStrategy(state: BusinessStateData, strategy: CommercialStrategyKey): string {
  const financials = state.financials;
  if (strategy === 'hire_seller') {
    const cost = 3500;
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
    state.commercial.baseDemand += 8;
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
  state.commercial.baseDemand += 3;
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

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
