import { ExpenseCategory, ExpenseLedger, FinanceLedger, GameStateData, Inventory, ItemType, MachineState, MachineType } from '../types';
import { ITEM_ORDER, MACHINE_CATALOG, MACHINE_ORDER } from '../data/catalog';

const STORAGE_KEY = 'factory-game-save-v1';
const EXPENSE_CATEGORIES: ExpenseCategory[] = ['materials', 'capex', 'upgrades', 'labor', 'energy', 'maintenance', 'rent', 'taxes', 'other'];
const BANKRUPTCY_LIMIT = -1000;

function createEmptyInventory(): Inventory {
  return {
    metal_ore: 0,
    metal_plate: 0,
    gear: 0,
    toolkit: 0
  };
}

function createEmptyExpenses(): ExpenseLedger {
  return {
    materials: 0,
    capex: 0,
    upgrades: 0,
    labor: 0,
    energy: 0,
    maintenance: 0,
    rent: 0,
    taxes: 0,
    other: 0
  };
}

function createFreshFinance(): FinanceLedger {
  return {
    day: 1,
    elapsedSeconds: 0,
    revenue: 0,
    expenses: createEmptyExpenses(),
    bankrupt: false
  };
}

function normalizeFinance(finance?: Partial<FinanceLedger>): FinanceLedger {
  const expenses = createEmptyExpenses();
  for (const category of EXPENSE_CATEGORIES) {
    expenses[category] = Number(finance?.expenses?.[category] ?? 0);
  }

  return {
    day: Math.max(1, Math.floor(Number(finance?.day ?? 1))),
    elapsedSeconds: Math.max(0, Number(finance?.elapsedSeconds ?? 0)),
    revenue: Number(finance?.revenue ?? 0),
    expenses,
    bankrupt: Boolean(finance?.bankrupt ?? false)
  };
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createStartingMachine(): MachineState {
  return {
    id: createId(),
    type: 'manual_bench',
    x: 2,
    y: 5,
    level: 1,
    progress: 0,
    running: false,
    starved: false,
    lastMessage: 'Aguardando insumo'
  };
}

export class GameState {
  data: GameStateData;

  private constructor(data: GameStateData) {
    this.data = data;
  }

  static fresh(): GameState {
    return new GameState({
      cash: 500,
      reputation: 1,
      totalSold: 0,
      inventory: {
        ...createEmptyInventory(),
        metal_ore: 20
      },
      machines: [createStartingMachine()],
      unlockedMachines: ['manual_bench', 'cutter'],
      selectedBuild: null,
      finance: createFreshFinance(),
      lastSavedAt: Date.now()
    });
  }

  static load(): GameState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return GameState.fresh();
      }

      const parsed = JSON.parse(raw) as Partial<GameStateData>;
      const mergedInventory = createEmptyInventory();

      for (const item of ITEM_ORDER) {
        mergedInventory[item] = Number(parsed.inventory?.[item] ?? 0);
      }

      return new GameState({
        cash: Number(parsed.cash ?? 500),
        reputation: Number(parsed.reputation ?? 1),
        totalSold: Number(parsed.totalSold ?? 0),
        inventory: mergedInventory,
        machines: Array.isArray(parsed.machines) ? parsed.machines : [createStartingMachine()],
        unlockedMachines: Array.isArray(parsed.unlockedMachines) ? parsed.unlockedMachines : ['manual_bench', 'cutter'],
        selectedBuild: parsed.selectedBuild ?? null,
        finance: normalizeFinance(parsed.finance),
        lastSavedAt: Number(parsed.lastSavedAt ?? Date.now())
      });
    } catch {
      return GameState.fresh();
    }
  }

  save(): void {
    this.data.lastSavedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }

  reset(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.data = GameState.fresh().data;
  }

  addItem(item: ItemType, amount: number): void {
    this.data.inventory[item] += amount;
  }

  removeItem(item: ItemType, amount: number): boolean {
    if (this.data.inventory[item] < amount) {
      return false;
    }

    this.data.inventory[item] -= amount;
    return true;
  }

  hasInputs(input: Partial<Record<ItemType, number>>): boolean {
    return Object.entries(input).every(([item, amount]) => {
      return this.data.inventory[item as ItemType] >= Number(amount);
    });
  }

  consumeInputs(input: Partial<Record<ItemType, number>>): boolean {
    if (!this.hasInputs(input)) {
      return false;
    }

    for (const [item, amount] of Object.entries(input)) {
      this.removeItem(item as ItemType, Number(amount));
    }

    return true;
  }

  addOutputs(output: Partial<Record<ItemType, number>>): void {
    for (const [item, amount] of Object.entries(output)) {
      this.addItem(item as ItemType, Number(amount));
    }
  }

  recordRevenue(amount: number): void {
    if (amount <= 0) return;
    this.data.finance.revenue += amount;
  }

  recordExpense(category: ExpenseCategory, amount: number): void {
    if (amount <= 0) return;
    this.data.finance.expenses[category] += amount;
  }

  payExpense(category: ExpenseCategory, amount: number): void {
    if (amount <= 0) return;
    this.data.cash -= amount;
    this.recordExpense(category, amount);
    this.updateBankruptcyRisk();
  }

  collectRevenue(amount: number): void {
    if (amount <= 0) return;
    this.data.cash += amount;
    this.data.totalSold += amount;
    this.recordRevenue(amount);
    this.data.reputation += Math.max(1, Math.floor(amount / 250));
    this.updateBankruptcyRisk();
  }

  advanceFinanceClock(deltaSeconds: number): void {
    this.data.finance.elapsedSeconds += Math.max(0, deltaSeconds);
    while (this.data.finance.elapsedSeconds >= 60) {
      this.data.finance.elapsedSeconds -= 60;
      this.data.finance.day += 1;
    }
  }

  buyMetal(amount: number): boolean {
    const cost = amount * 5;
    if (this.data.cash < cost) {
      return false;
    }

    this.payExpense('materials', cost);
    this.data.inventory.metal_ore += amount;
    this.save();
    return true;
  }

  unlockAvailableMachines(): MachineType[] {
    const newlyUnlocked: MachineType[] = [];

    for (const type of MACHINE_ORDER) {
      const machine = MACHINE_CATALOG[type];

      if (!this.data.unlockedMachines.includes(type) && this.data.cash >= machine.unlockCash) {
        this.data.unlockedMachines.push(type);
        newlyUnlocked.push(type);
      }
    }

    if (newlyUnlocked.length > 0) {
      this.save();
    }

    return newlyUnlocked;
  }

  canPlaceMachine(type: MachineType, x: number, y: number): boolean {
    const machine = MACHINE_CATALOG[type];

    if (!this.data.unlockedMachines.includes(type)) {
      return false;
    }

    if (this.data.cash < machine.cost) {
      return false;
    }

    return !this.data.machines.some((existing) => existing.x === x && existing.y === y);
  }

  placeMachine(type: MachineType, x: number, y: number): boolean {
    if (!this.canPlaceMachine(type, x, y)) {
      return false;
    }

    this.payExpense('capex', MACHINE_CATALOG[type].cost);
    this.data.machines.push({
      id: createId(),
      type,
      x,
      y,
      level: 1,
      progress: 0,
      running: false,
      starved: false,
      lastMessage: 'Nova maquina instalada'
    });

    this.save();
    return true;
  }

  upgradeMachine(machineId: string, cost: number): boolean {
    const machine = this.data.machines.find((item) => item.id === machineId);

    if (!machine || this.data.cash < cost) {
      return false;
    }

    this.payExpense('upgrades', cost);
    machine.level += 1;
    machine.lastMessage = `Upgrade para nivel ${machine.level}`;
    this.save();

    return true;
  }

  private updateBankruptcyRisk(): void {
    this.data.finance.bankrupt = this.data.cash <= BANKRUPTCY_LIMIT;
  }
}
