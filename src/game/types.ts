export type ItemType = 'metal_ore' | 'metal_plate' | 'gear' | 'toolkit';

export type MachineType = 'manual_bench' | 'cutter' | 'press' | 'assembler';

export type Inventory = Record<ItemType, number>;

export interface ItemDefinition {
  type: ItemType;
  name: string;
  salePrice: number;
  buyPrice?: number;
}

export interface MachineDefinition {
  type: MachineType;
  name: string;
  shortName: string;
  description: string;
  cost: number;
  upgradeBaseCost: number;
  color: number;
  input: Partial<Record<ItemType, number>>;
  output: Partial<Record<ItemType, number>>;
  cycleSeconds: number;
  unlockCash: number;
}

export interface MachineState {
  id: string;
  type: MachineType;
  x: number;
  y: number;
  level: number;
  progress: number;
  running: boolean;
  starved: boolean;
  lastMessage: string;
}

export interface GameStateData {
  cash: number;
  reputation: number;
  totalSold: number;
  inventory: Inventory;
  machines: MachineState[];
  unlockedMachines: MachineType[];
  selectedBuild: MachineType | null;
  lastSavedAt: number;
}
