import { MACHINE_CATALOG } from '../data/catalog';
import { GameState } from '../state/GameState';
import { ExpenseLedger } from '../types';

export interface DreSnapshot {
  day: number;
  revenue: number;
  grossRevenue: number;
  taxes: number;
  materials: number;
  labor: number;
  energy: number;
  maintenance: number;
  rent: number;
  capex: number;
  upgrades: number;
  other: number;
  operatingCosts: number;
  ebitda: number;
  netResult: number;
  margin: number;
  burnRatePerDay: number;
  runwayDays: number;
  breakEvenRevenue: number;
  risk: 'saudavel' | 'atencao' | 'critico' | 'quebrou';
}

const DAY_SECONDS = 60;
const RENT_PER_DAY = 18;
const BASE_ADMIN_PER_DAY = 10;
const LABOR_PER_MACHINE_PER_DAY = 5.5;
const ENERGY_PER_ACTIVE_MACHINE_PER_DAY = 3.2;
const MAINTENANCE_RATE_PER_DAY = 0.004;
const TAX_RATE = 0.08;

function sumExpenses(expenses: ExpenseLedger): number {
  return Object.values(expenses).reduce((total, value) => total + value, 0);
}

export function accrueOperatingCosts(state: GameState, deltaSeconds: number): void {
  const dayFraction = deltaSeconds / DAY_SECONDS;
  if (dayFraction <= 0) return;

  const machineCount = state.data.machines.length;
  const runningCount = state.data.machines.filter((machine) => machine.running).length;
  const assetBase = state.data.machines.reduce((total, machine) => total + MACHINE_CATALOG[machine.type].cost * (1 + (machine.level - 1) * 0.32), 0);

  state.advanceFinanceClock(deltaSeconds);
  state.payExpense('rent', RENT_PER_DAY * dayFraction);
  state.payExpense('labor', (BASE_ADMIN_PER_DAY + machineCount * LABOR_PER_MACHINE_PER_DAY) * dayFraction);
  state.payExpense('energy', runningCount * ENERGY_PER_ACTIVE_MACHINE_PER_DAY * dayFraction);
  state.payExpense('maintenance', assetBase * MAINTENANCE_RATE_PER_DAY * dayFraction);
}

export function recordSaleWithTaxes(state: GameState, grossRevenue: number): number {
  if (grossRevenue <= 0) return 0;
  const taxes = grossRevenue * TAX_RATE;
  const netRevenue = grossRevenue - taxes;
  state.collectRevenue(netRevenue);
  state.recordExpense('taxes', taxes);
  return netRevenue;
}

export function getDreSnapshot(state: GameState): DreSnapshot {
  const { finance, cash } = state.data;
  const expenses = finance.expenses;
  const totalExpenses = sumExpenses(expenses);
  const operatingCosts = expenses.materials + expenses.labor + expenses.energy + expenses.maintenance + expenses.rent + expenses.taxes + expenses.other;
  const ebitda = finance.revenue - operatingCosts;
  const netResult = finance.revenue - totalExpenses;
  const margin = finance.revenue > 0 ? netResult / finance.revenue : 0;
  const daysElapsed = Math.max(1, finance.day + finance.elapsedSeconds / DAY_SECONDS - 1);
  const burnRatePerDay = totalExpenses / daysElapsed;
  const breakEvenRevenue = operatingCosts;
  const runwayDays = burnRatePerDay > 0 ? cash / burnRatePerDay : 999;

  let risk: DreSnapshot['risk'] = 'saudavel';
  if (finance.bankrupt || cash <= -1000) risk = 'quebrou';
  else if (cash < 150 || runwayDays < 2 || netResult < -500) risk = 'critico';
  else if (cash < 500 || margin < 0.08) risk = 'atencao';

  return {
    day: finance.day,
    revenue: finance.revenue,
    grossRevenue: finance.revenue + expenses.taxes,
    taxes: expenses.taxes,
    materials: expenses.materials,
    labor: expenses.labor,
    energy: expenses.energy,
    maintenance: expenses.maintenance,
    rent: expenses.rent,
    capex: expenses.capex,
    upgrades: expenses.upgrades,
    other: expenses.other,
    operatingCosts,
    ebitda,
    netResult,
    margin,
    burnRatePerDay,
    runwayDays,
    breakEvenRevenue,
    risk
  };
}
