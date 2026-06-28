import Phaser from 'phaser';
import { GRID, ITEM_CATALOG, ITEM_ORDER, MACHINE_CATALOG, MACHINE_ORDER, getMachineSpeedMultiplier, getUpgradeCost } from '../data/catalog';
import { GameState } from '../state/GameState';
import { FactorySimulator } from '../systems/FactorySimulator';
import { ItemType, MachineState, MachineType } from '../types';

type MachineView = {
  container: Phaser.GameObjects.Container;
  progress: Phaser.GameObjects.Rectangle;
  status: Phaser.GameObjects.Text;
  level: Phaser.GameObjects.Text;
  glow: Phaser.GameObjects.Arc;
  core: Phaser.GameObjects.Rectangle;
};

type ButtonView = {
  box: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private simulator!: FactorySimulator;
  private cashText!: Phaser.GameObjects.Text;
  private inventoryText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private productionText!: Phaser.GameObjects.Text;
  private machineStatsText!: Phaser.GameObjects.Text;
  private selectedText!: Phaser.GameObjects.Text;
  private factoryTitle!: Phaser.GameObjects.Text;
  private machineButtons = new Map<MachineType, ButtonView>();
  private selectedMachineId: string | null = null;
  private machineViews = new Map<string, MachineView>();
  private lastStatus = 'Sistema online. Compre insumos, produza, venda e reinvista.';
  private autosaveTimer = 0;
  private pulseTime = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    this.state = GameState.load();
    this.simulator = new FactorySimulator(this.state);

    this.drawEnvironment();
    this.createPanel();
    this.createGridInput();
    this.syncMachineViews(true);
    this.updateHud();
  }

  update(_time: number, delta: number) {
    this.pulseTime += delta / 1000;

    const events = this.simulator.tick(delta / 1000);
    const unlocked = this.state.unlockAvailableMachines();

    if (events.length > 0) {
      this.lastStatus = events[events.length - 1].message;
    }

    if (unlocked.length > 0) {
      this.lastStatus = `Nova maquina liberada: ${unlocked.map((type) => MACHINE_CATALOG[type].shortName).join(', ')}`;
    }

    this.autosaveTimer += delta / 1000;
    if (this.autosaveTimer >= 8) {
      this.autosaveTimer = 0;
      this.state.save();
    }

    this.updateMachineViews();
    this.updateHud();
  }

  private drawEnvironment() {
    this.add.rectangle(0, 0, 1280, 720, 0x05070d).setOrigin(0);

    this.add.circle(200, 120, 360, 0x0f2c4d, 0.28);
    this.add.circle(760, 520, 420, 0x101a37, 0.42);
    this.add.circle(1120, 150, 300, 0x19294a, 0.35);

    const bg = this.add.graphics();
    bg.lineStyle(1, 0x10223b, 0.35);
    for (let x = -120; x < 1280; x += 46) {
      bg.lineBetween(x, 0, x + 340, 720);
    }
    for (let x = 40; x < 1500; x += 58) {
      bg.lineBetween(x, 0, x - 340, 720);
    }

    this.add.rectangle(0, 0, 1280, 78, 0x090f1c, 0.95).setOrigin(0).setStrokeStyle(1, 0x253b5c, 0.85);
    this.add.rectangle(0, 77, 1280, 2, 0xd9f4ff, 0.28).setOrigin(0);

    this.add.rectangle(930, 76, 350, 644, 0x080d18, 0.94).setOrigin(0).setStrokeStyle(1, 0x314765, 0.8);
    this.add.rectangle(938, 86, 334, 626, 0x0d1526, 0.72).setOrigin(0).setStrokeStyle(1, 0xffffff, 0.08);

    this.factoryTitle = this.add.text(32, 20, 'NEO FACTORY OS', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold'
    });
    this.add.text(34, 48, 'industrial automation prototype', {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: '#8fb5d7'
    });

    this.drawFactoryFloor();
  }

  private drawFactoryFloor() {
    const x = GRID.originX;
    const y = GRID.originY;
    const w = GRID.cols * GRID.cell;
    const h = GRID.rows * GRID.cell;

    const floor = this.add.graphics();
    floor.fillStyle(0x08111f, 0.95);
    floor.fillRoundedRect(x - 14, y - 14, w + 28, h + 28, 18);
    floor.lineStyle(2, 0xffffff, 0.12);
    floor.strokeRoundedRect(x - 14, y - 14, w + 28, h + 28, 18);

    floor.fillStyle(0x03060c, 0.45);
    floor.fillRect(x + 14, y + h + 8, w, 20);

    floor.lineStyle(1, 0x1b395d, 0.6);
    for (let col = 0; col <= GRID.cols; col++) {
      const gx = x + col * GRID.cell;
      floor.lineBetween(gx, y, gx, y + h);
    }

    for (let row = 0; row <= GRID.rows; row++) {
      const gy = y + row * GRID.cell;
      floor.lineBetween(x, gy, x + w, gy);
    }

    floor.lineStyle(1, 0xffffff, 0.08);
    for (let col = -GRID.rows; col < GRID.cols; col += 2) {
      const gx = x + col * GRID.cell;
      floor.lineBetween(gx, y + h, gx + h, y);
    }

    floor.fillStyle(0xd9f4ff, 0.65);
    for (let col = 0; col <= GRID.cols; col += 3) {
      for (let row = 0; row <= GRID.rows; row += 3) {
        floor.fillCircle(x + col * GRID.cell, y + row * GRID.cell, 2);
      }
    }

    this.add.text(x, y - 36, 'PRODUCTION FLOOR', {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: '#d9f4ff',
      fontStyle: 'bold'
    });
  }

  private createPanel() {
    this.cashText = this.add.text(250, 18, '', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold'
    });

    this.inventoryText = this.add.text(470, 16, '', {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: '#d6e8f7',
      lineSpacing: 5
    });

    this.add.text(958, 104, 'COMMAND CENTER', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold'
    });

    this.add.text(958, 130, 'Construa maquinas, veja gargalos e acompanhe capacidade/min em tempo real.', {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#8fa9c9',
      wordWrap: { width: 286 }
    });

    this.createButton(958, 174, 138, 40, 'COMPRAR METAL x10', () => {
      const ok = this.state.buyMetal(10);
      this.lastStatus = ok ? 'Entrada de materia-prima: +10 metal bruto.' : 'Saldo insuficiente para comprar metal.';
    });

    this.createButton(1106, 174, 118, 40, 'VENDER TUDO', () => this.sellAll());

    this.add.text(958, 232, 'MAQUINAS', {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: '#ffffff',
      fontStyle: 'bold'
    });

    MACHINE_ORDER.forEach((type, index) => {
      const button = this.createButton(958, 262 + index * 58, 266, 48, MACHINE_CATALOG[type].shortName, () => {
        this.selectBuild(type);
      });
      this.machineButtons.set(type, button);
    });

    this.add.text(958, 506, 'PRODUCAO', {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: '#ffffff',
      fontStyle: 'bold'
    });

    this.productionText = this.add.text(958, 532, '', {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#d9f4ff',
      lineSpacing: 5,
      wordWrap: { width: 286 }
    });

    this.machineStatsText = this.add.text(958, 604, '', {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#b5c8dc',
      lineSpacing: 4,
      wordWrap: { width: 286 }
    });

    this.selectedText = this.add.text(958, 654, '', {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#ffffff',
      wordWrap: { width: 286 }
    });

    this.statusText = this.add.text(32, 660, '', {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: '#f8fafc',
      wordWrap: { width: 850 }
    });
  }

  private createGridInput() {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.x >= 930 || pointer.y < GRID.originY) return;

      const cell = this.getCell(pointer.x, pointer.y);
      if (!cell) return;

      const existing = this.state.data.machines.find((machine) => machine.x === cell.x && machine.y === cell.y);
      if (existing) {
        this.selectMachine(existing, Boolean((pointer.event as MouseEvent).shiftKey));
        return;
      }

      if (!this.state.data.selectedBuild) return;

      const builtType = this.state.data.selectedBuild;
      const built = this.state.placeMachine(builtType, cell.x, cell.y);
      this.lastStatus = built ? `${MACHINE_CATALOG[builtType].name} instalada no setor ${cell.x + 1}.${cell.y + 1}.` : 'Nao foi possivel construir aqui.';
      this.syncMachineViews(false);
    });
  }

  private getCell(worldX: number, worldY: number): { x: number; y: number } | null {
    const x = Math.floor((worldX - GRID.originX) / GRID.cell);
    const y = Math.floor((worldY - GRID.originY) / GRID.cell);

    if (x < 0 || y < 0 || x >= GRID.cols || y >= GRID.rows) return null;
    return { x, y };
  }

  private selectBuild(type: MachineType) {
    if (!this.state.data.unlockedMachines.includes(type)) {
      this.lastStatus = `Modulo bloqueado. Alcance R$ ${MACHINE_CATALOG[type].unlockCash}.`;
      return;
    }

    if (this.state.data.cash < MACHINE_CATALOG[type].cost) {
      this.lastStatus = `Saldo insuficiente. ${MACHINE_CATALOG[type].name} custa R$ ${MACHINE_CATALOG[type].cost}.`;
      return;
    }

    this.state.data.selectedBuild = this.state.data.selectedBuild === type ? null : type;
    this.selectedMachineId = null;
    this.lastStatus = this.state.data.selectedBuild ? `Modo construcao: ${MACHINE_CATALOG[type].name}. Clique em um slot vazio.` : 'Construcao cancelada.';
  }

  private selectMachine(machine: MachineState, upgrade: boolean) {
    this.selectedMachineId = machine.id;
    this.state.data.selectedBuild = null;

    const definition = MACHINE_CATALOG[machine.type];
    const cost = getUpgradeCost(machine.type, machine.level);

    if (upgrade) {
      const ok = this.state.upgradeMachine(machine.id, cost);
      this.lastStatus = ok ? `${definition.name} atualizada para nivel ${machine.level}. Capacidade aumentada.` : `Upgrade custa R$ ${cost}.`;
      return;
    }

    this.lastStatus = `${definition.name} nivel ${machine.level}. Shift + clique para upgrade por R$ ${cost}.`;
  }

  private sellAll() {
    let revenue = 0;

    for (const item of ITEM_ORDER) {
      if (item === 'metal_ore') continue;
      const quantity = this.state.data.inventory[item];
      revenue += quantity * ITEM_CATALOG[item].salePrice;
      this.state.data.inventory[item] = 0;
    }

    if (revenue <= 0) {
      this.lastStatus = 'Estoque vendido: R$ 0. Nenhum produto acabado disponivel.';
      return;
    }

    this.state.data.cash += revenue;
    this.state.data.totalSold += revenue;
    this.state.data.reputation += Math.max(1, Math.floor(revenue / 250));
    this.state.save();
    this.lastStatus = `Despacho concluido. Receita: R$ ${Math.floor(revenue).toLocaleString('pt-BR')}.`;
  }

  private syncMachineViews(initial: boolean) {
    for (const view of this.machineViews.values()) {
      view.container.destroy();
    }

    this.machineViews.clear();

    for (const machine of this.state.data.machines) {
      this.createMachineView(machine, !initial);
    }
  }

  private createMachineView(machine: MachineState, animate: boolean) {
    const definition = MACHINE_CATALOG[machine.type];
    const x = GRID.originX + machine.x * GRID.cell + GRID.cell / 2;
    const y = GRID.originY + machine.y * GRID.cell + GRID.cell / 2;

    const shadow = this.add.ellipse(2, 24, 46, 15, 0x000000, 0.45);
    const platform = this.add.rectangle(0, 16, 46, 16, 0x101928, 1).setStrokeStyle(1, 0xffffff, 0.13);
    const rear = this.add.rectangle(4, -5, 36, 28, 0x050a13, 0.9).setStrokeStyle(1, definition.color, 0.42);
    const core = this.add.rectangle(0, -10, 38, 34, definition.color, 0.94).setStrokeStyle(2, 0xffffff, 0.72);
    const top = this.add.rectangle(-2, -24, 32, 10, 0xffffff, 0.22).setStrokeStyle(1, 0xffffff, 0.32);
    const light = this.add.circle(14, -21, 3, 0xffffff, 0.95);
    const glow = this.add.circle(0, -10, 32, definition.color, 0.16);
    const label = this.add.text(0, -11, definition.shortName.slice(0, 3).toUpperCase(), {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    const level = this.add.text(0, 6, `NV.${machine.level}`, {
      fontFamily: 'Arial',
      fontSize: '9px',
      color: '#eaf8ff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    const back = this.add.rectangle(0, 31, 42, 5, 0x05070d, 1).setOrigin(0.5).setStrokeStyle(1, 0xffffff, 0.1);
    const progress = this.add.rectangle(-21, 31, 0, 5, 0xd9f4ff, 0.95).setOrigin(0, 0.5);
    const status = this.add.text(0, 41, '', {
      fontFamily: 'Arial',
      fontSize: '9px',
      color: '#cbd5e1'
    }).setOrigin(0.5);

    const container = this.add.container(x, y, [glow, shadow, rear, platform, core, top, light, label, level, back, progress, status]);

    if (animate) {
      container.setScale(0.2);
      container.setAlpha(0.1);
      this.tweens.add({
        targets: container,
        scale: 1,
        alpha: 1,
        duration: 360,
        ease: 'Back.Out'
      });
      this.tweens.add({
        targets: glow,
        alpha: 0.45,
        yoyo: true,
        duration: 420,
        ease: 'Sine.InOut'
      });
    }

    this.machineViews.set(machine.id, { container, progress, status, level, glow, core });
  }

  private updateMachineViews() {
    for (const machine of this.state.data.machines) {
      const view = this.machineViews.get(machine.id);
      if (!view) continue;

      const selected = this.selectedMachineId === machine.id;
      const pulse = Math.sin(this.pulseTime * 5 + machine.x + machine.y) * 0.06;
      view.container.setScale(selected ? 1.12 : 1 + pulse);
      view.progress.width = Math.max(0, Math.min(42, machine.progress * 42));
      view.level.setText(`NV.${machine.level}`);
      view.glow.setAlpha(machine.running ? 0.27 + Math.abs(pulse) : 0.1);
      view.core.setAlpha(machine.running ? 1 : 0.84);

      if (machine.starved) {
        view.status.setColor('#fb7185');
        view.status.setText('SEM INSUMO');
      } else if (machine.running) {
        view.status.setColor('#d9f4ff');
        view.status.setText('ONLINE');
      } else {
        view.status.setColor('#cbd5e1');
        view.status.setText('PRONTO');
      }
    }
  }

  private updateHud() {
    this.cashText.setText(`R$ ${Math.floor(this.state.data.cash).toLocaleString('pt-BR')}`);
    this.inventoryText.setText(ITEM_ORDER.map((item) => `${ITEM_CATALOG[item].name}: ${Math.floor(this.state.data.inventory[item])}`).join('   '));
    this.statusText.setText(this.lastStatus);

    this.productionText.setText(this.getProductionSummary());
    this.machineStatsText.setText(this.getMachineSummary());
    this.selectedText.setText(this.getSelectedSummary());
    this.updateMachineButtons();
  }

  private getProductionSummary(): string {
    const capacity = this.getCapacityByItem();
    const lines: string[] = [];

    for (const item of ITEM_ORDER) {
      if (item === 'metal_ore') continue;
      const amount = capacity[item] ?? 0;
      if (amount > 0) {
        lines.push(`${ITEM_CATALOG[item].name}: ${amount.toFixed(1)}/min`);
      }
    }

    const revenuePerMinute = ITEM_ORDER.reduce((total, item) => {
      if (item === 'metal_ore') return total;
      return total + (capacity[item] ?? 0) * ITEM_CATALOG[item].salePrice;
    }, 0);

    lines.push(`Capacidade bruta: R$ ${Math.floor(revenuePerMinute).toLocaleString('pt-BR')}/min`);
    return lines.join('\n');
  }

  private getMachineSummary(): string {
    const counts = this.getMachineCounts();
    const total = this.state.data.machines.length;
    const lines = [`Maquinas instaladas: ${total}`];

    for (const type of MACHINE_ORDER) {
      const count = counts[type] ?? 0;
      if (count > 0) {
        lines.push(`${MACHINE_CATALOG[type].shortName}: ${count} un.`);
      }
    }

    return lines.join('  |  ');
  }

  private getSelectedSummary(): string {
    const selected = this.state.data.machines.find((machine) => machine.id === this.selectedMachineId);
    if (!selected) {
      return 'Selecione uma maquina para ver nivel, upgrade e capacidade individual.';
    }

    const definition = MACHINE_CATALOG[selected.type];
    const cost = getUpgradeCost(selected.type, selected.level);
    const outputs = Object.entries(definition.output)
      .map(([item, amount]) => `${((Number(amount) * 60 * getMachineSpeedMultiplier(selected.level)) / definition.cycleSeconds).toFixed(1)} ${ITEM_CATALOG[item as ItemType].name}/min`)
      .join(' + ');

    return `${definition.name} | Nivel ${selected.level} | ${outputs} | Upgrade R$ ${cost}`;
  }

  private updateMachineButtons() {
    const counts = this.getMachineCounts();

    for (const type of MACHINE_ORDER) {
      const button = this.machineButtons.get(type);
      if (!button) continue;

      const definition = MACHINE_CATALOG[type];
      const unlocked = this.state.data.unlockedMachines.includes(type);
      const selected = this.state.data.selectedBuild === type;
      const count = counts[type] ?? 0;
      const status = unlocked ? `R$ ${definition.cost} | ${count} un.` : `bloqueada em R$ ${definition.unlockCash}`;
      button.label.setText(`${selected ? '> ' : ''}${definition.shortName.toUpperCase()}\n${status}`);
      button.box.setAlpha(unlocked ? 1 : 0.42);
      button.box.setStrokeStyle(selected ? 2 : 1, selected ? 0xffffff : 0x31506f, selected ? 0.9 : 0.5);
    }
  }

  private getMachineCounts(): Record<MachineType, number> {
    const counts = {} as Record<MachineType, number>;
    for (const type of MACHINE_ORDER) counts[type] = 0;
    for (const machine of this.state.data.machines) counts[machine.type] += 1;
    return counts;
  }

  private getCapacityByItem(): Partial<Record<ItemType, number>> {
    const capacity: Partial<Record<ItemType, number>> = {};

    for (const machine of this.state.data.machines) {
      const definition = MACHINE_CATALOG[machine.type];
      const multiplier = getMachineSpeedMultiplier(machine.level);

      for (const [item, amount] of Object.entries(definition.output)) {
        capacity[item as ItemType] = (capacity[item as ItemType] ?? 0) + (Number(amount) * 60 * multiplier) / definition.cycleSeconds;
      }
    }

    return capacity;
  }

  private createButton(x: number, y: number, width: number, height: number, text: string, onClick: () => void): ButtonView {
    const box = this.add.rectangle(0, 0, width, height, 0x111d31, 0.95).setOrigin(0).setStrokeStyle(1, 0x31506f, 0.5);
    const shine = this.add.rectangle(2, 2, width - 4, 1, 0xffffff, 0.22).setOrigin(0);
    const label = this.add.text(width / 2, height / 2, text, {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#ffffff',
      align: 'center',
      fontStyle: 'bold',
      wordWrap: { width: width - 14 }
    }).setOrigin(0.5);

    const button = this.add.container(x, y, [box, shine, label]);
    button.setSize(width, height);
    button.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
    button.on('pointerover', () => box.setFillStyle(0x1a2c4a, 1));
    button.on('pointerout', () => box.setFillStyle(0x111d31, 0.95));
    button.on('pointerdown', onClick);

    return { box, label };
  }
}
