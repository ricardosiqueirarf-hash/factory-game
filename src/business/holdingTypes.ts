export type HoldingTab = 'dashboard' | 'market' | 'portfolio' | 'managers' | 'events';

export type Sector = 'Moveleiro' | 'Vidro' | 'Metal' | 'Alimentos' | 'Textil' | 'Distribuicao' | 'Embalagens';

export type ManagerType = 'Operacional' | 'Financeiro' | 'Comercial' | 'Estoque' | 'CEO Profissional' | 'Turnaround' | 'Escala';

export type ManagerRarity = 'Comum' | 'Raro' | 'Epico' | 'Lendario';

export interface UpgradeEffect {
  revenuePct?: number;
  costPct?: number;
  efficiency?: number;
  quality?: number;
  demand?: number;
  risk?: number;
  potential?: number;
  valuationMultiple?: number;
}

export interface UpgradeDefinition {
  id: string;
  name: string;
  description: string;
  cost: number;
  effect: UpgradeEffect;
}

export interface ManagerBonus {
  revenuePct?: number;
  costPct?: number;
  efficiency?: number;
  quality?: number;
  demand?: number;
  risk?: number;
  potential?: number;
}

export interface Manager {
  id: string;
  name: string;
  type: ManagerType;
  rarity: ManagerRarity;
  salaryMonthly: number;
  bonus: ManagerBonus;
  description: string;
  assignedCompanyId: string | null;
}

export interface Company {
  id: string;
  name: string;
  sector: Sector;
  purchasePrice: number;
  monthlyRevenue: number;
  monthlyCost: number;
  monthlyProfit: number;
  efficiency: number;
  quality: number;
  demand: number;
  risk: number;
  debt: number;
  potential: number;
  valuationMultiple: number;
  estimatedValue: number;
  upgradesApplied: string[];
  managerId: string | null;
  rareOpportunity?: boolean;
}

export interface EventRecord {
  id: string;
  month: number;
  title: string;
  description: string;
  impact: 'good' | 'bad' | 'neutral';
}

export interface HoldingState {
  capital: number;
  month: number;
  reputation: number;
  activeTab: HoldingTab;
  market: Company[];
  portfolio: Company[];
  managers: Manager[];
  history: EventRecord[];
}
