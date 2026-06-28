export type CompanyStatus = 'player' | 'manager';

export interface PortfolioMaterial {
  name: string;
  unit: string;
  stock: number;
  monthlyFlow: number;
  unitCost: number;
  perOrder: number;
  reorderFormula: string;
  quantityFormula: string;
}

export interface CompanyQuarterReport {
  quarter: number;
  revenue: number;
  expenses: number;
  managerSalary: number;
  profit: number;
  margin: number;
  cashDistributed: number;
}

export interface PortfolioCompany {
  id: string;
  name: string;
  level: number;
  status: CompanyStatus;
  month: number;
  quarter: number;
  averageRevenue: number;
  cash: number;
  revenueMonth: number;
  expensesMonth: number;
  profitMonth: number;
  marginMonth: number;
  lostRevenueMonth: number;
  managerSalary: number;
  materials: PortfolioMaterial[];
  reports: CompanyQuarterReport[];
}

export interface PortfolioState {
  founderCapital: number;
  companies: PortfolioCompany[];
  selectedCompanyId: string;
  maxUnlockedLevel: number;
  message: string;
}
