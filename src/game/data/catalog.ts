import { ItemDefinition, ItemType, MachineDefinition, MachineType } from '../types';

export const GRID = {
  originX: 32,
  originY: 88,
  cols: 18,
  rows: 12,
  cell: 48
};

export const ITEM_ORDER: ItemType[] = ['metal_ore', 'metal_plate', 'gear', 'toolkit'];

export const ITEM_CATALOG: Record<ItemType, ItemDefinition> = {
  metal_ore: {
    type: 'metal_ore',
    name: 'Metal bruto',
    salePrice: 2,
    buyPrice: 5
  },
  metal_plate: {
    type: 'metal_plate',
    name: 'Chapa metalica',
    salePrice: 12
  },
  gear: {
    type: 'gear',
    name: 'Engrenagem',
    salePrice: 8
  },
  toolkit: {
    type: 'toolkit',
    name: 'Kit industrial',
    salePrice: 70
  }
};

export const MACHINE_ORDER: MachineType[] = ['manual_bench', 'cutter', 'press', 'assembler'];

export const MACHINE_CATALOG: Record<MachineType, MachineDefinition> = {
  manual_bench: {
    type: 'manual_bench',
    name: 'Bancada Manual',
    shortName: 'Bancada',
    description: 'Transforma metal bruto em chapas simples.',
    cost: 100,
    upgradeBaseCost: 80,
    color: 0x5477ff,
    input: { metal_ore: 1 },
    output: { metal_plate: 1 },
    cycleSeconds: 4,
    unlockCash: 0
  },
  cutter: {
    type: 'cutter',
    name: 'Serra de Corte',
    shortName: 'Serra',
    description: 'Corta chapas em engrenagens vendaveis.',
    cost: 260,
    upgradeBaseCost: 180,
    color: 0x24c6a3,
    input: { metal_plate: 1 },
    output: { gear: 2 },
    cycleSeconds: 5,
    unlockCash: 250
  },
  press: {
    type: 'press',
    name: 'Prensa Industrial',
    shortName: 'Prensa',
    description: 'Produz engrenagens em lote com melhor eficiencia.',
    cost: 650,
    upgradeBaseCost: 420,
    color: 0xffb84d,
    input: { metal_plate: 2 },
    output: { gear: 6 },
    cycleSeconds: 8,
    unlockCash: 900
  },
  assembler: {
    type: 'assembler',
    name: 'Montadora',
    shortName: 'Montadora',
    description: 'Monta kits industriais de alto valor.',
    cost: 1400,
    upgradeBaseCost: 900,
    color: 0xff6f91,
    input: { metal_plate: 2, gear: 4 },
    output: { toolkit: 1 },
    cycleSeconds: 10,
    unlockCash: 1800
  }
};

export function getMachineSpeedMultiplier(level: number): number {
  return 1 + (level - 1) * 0.28;
}

export function getUpgradeCost(type: MachineType, level: number): number {
  return Math.round(MACHINE_CATALOG[type].upgradeBaseCost * Math.pow(1.65, level - 1));
}
