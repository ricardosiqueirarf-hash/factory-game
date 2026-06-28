export type CompanyKind = 'doors_factory' | 'sawmill';

export type Department = 'logistics' | 'commercial' | 'finance';

export type MaterialKey = 'aluminum' | 'glass' | 'hardware' | 'raw_wood' | 'glue' | 'varnish';

export type CommercialStrategyKey = 'hire_seller' | 'marketing' | 'training' | 'reallocate_sales';

export interface MaterialState {
  key: MaterialKey;
  name: string;
  unit: string;
  stock: number;
  unitCost: number;
  monthlyFlow: number;
  demandVariation: number;
  reorderFormula: string;
  quantityFormula: string;
  purchasedMonth: number;
  rupturesMonth: number;
  idleStockCost: number;
}

export interface IndicatorDefinition {
  id: string;
  name: string;
  formula: string;
  value: number;
  error?: string;
}

export interface CommercialState {
  baseDemand: number;
  salesCapacity: number;
  sellers: number;
  marketingLevel: number;
  trainingLevel: number;
  salesFocus: number;
}

export interface BusinessFinancials {
  cash: number;
  revenueMonth: number;
  lostRevenueMonth: number;
  purchasesMonth: number;
  stockHoldingCostMonth: number;
  commercialCostMonth: number;
  fixedCostMonth: number;
  grossMarginMonth: number;
  resultMonth: number;
  totalRevenue: number;
  totalResult: number;
}

export interface BusinessStateData {
  companyKind: CompanyKind | null;
  month: number;
  elapsedSeconds: number;
  materials: MaterialState[];
  indicators: IndicatorDefinition[];
  commercial: CommercialState;
  financials: BusinessFinancials;
  selectedDepartment: Department;
  lastMessage: string;
}

export interface MonthResult {
  month: number;
  demandedUnits: number;
  fulfilledUnits: number;
  lostUnits: number;
  revenue: number;
  lostRevenue: number;
  purchases: number;
  result: number;
}
