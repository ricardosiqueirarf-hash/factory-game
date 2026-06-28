import Phaser from 'phaser';
import { GRID, ITEM_CATALOG, ITEM_ORDER, MACHINE_CATALOG, MACHINE_ORDER, getUpgradeCost } from '../data/catalog';
import { GameState } from '../state/GameState';
import { FactorySimulator } from '../systems/FactorySimulator';
import { MachineState, MachineType } from '../types';

type MachineView = {
  container: Phaser.GameObjects.Container;
  progress: Phaser.GameObjects.Rectangle;
  status: Phaser.GameObjects.Text;
  level: Phaser.GameObjects.Text;
};

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private simulator!: FactorySimulator;
  private cashText!: Phaser.GameObjects.Text;
  private inventoryText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private selectedMachineId: string | null = null;
  private machineViews = new Map<string, MachineView>();
  private lastStatus = 'Compre insumos, produza, venda e reinvista.';
  private autosaveTimer = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    this.state = GameState.load();
    this.simulator = new FactorySimulator(this.state);

    this.drawBase();
    this.createPanel();
    this.createGridInput();
    this.syncMachineViews();
    this.updateHud();
  }

  update(_time: number, delta: number) {
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

  private drawBase() {
    this.add.rectangle(0, 0, 1280, 720, 0x070b14).setOrigin(0);
    this.add.rectangle(0, 0, 1280, 76, 0x0f172a).setOrigin(0);
    this.add.rectangle(930, 76, 350, 644, 0x111827).setOrigin(0);

    this.add.text(32, 36, 'Linha de Producao', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#cbd5e1',
      fontStyle: 'bold'
    });

    const grid = this.add.graphics();
    grid.fillStyle(0x0b1220, 0.55);
    grid.fillRect(GRID.originX, GRID.originY, GRID.cols * GRID.cell, GRID.rows * GRID.cell);
    grid.lineStyle(1, 0x1e293b, 1);

    for (let col = 0; col <= GRID.cols; col++) {
      const x = GRID.originX + col * GRID.cell;
      grid.lineBetween(x, GRID.originY, x, GRID.originY + GRID.rows * GRID.cell);
    }

    for (let row = 0; row <= GRID.rows; row++) {
      const y = GRID.originY + row * GRID.cell;
      grid.lineBetween(GRID.originX, y, GRID.originX + GRID.cols * GRID.cell, y);
    }
  }

  private createPanel() {
    this.cashText = this.add.text(24, 18, '', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold'
    });

    this.inventoryText = this.add.text(350, 14, '', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#cbd5e1',
      lineSpacing: 4
    });

    this.add.text(954, 96, 'Factory Game', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold'
    });

    this.add.text(954, 130, 'Escolha uma maquina e clique no grid. Clique em uma maquina para selecionar. Shift + clique melhora a maquina.', {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: '#94a3b8',
      wordWrap: { width: 280 }
    });

    this.createButton(954, 184, 140, 38, 'Comprar metal x10', () => {
      const ok = this.state.buyMetal(10);
      this.lastStatus = ok ? 'Comprou 10x metal bruto.' : 'Dinheiro insuficiente.';
    });

    this.createButton(1104, 184, 120, 38, 'Vender tudo', () => this.sellAll());

    this.add.text(954, 246, 'Construcao', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    });

    MACHINE_ORDER.forEach((type, index) => {
      this.createButton(954, 282 + index * 62, 270, 46, MACHINE_CATALOG[type].shortName, () => {
        this.selectBuild(type);
      });
    });

    this.createButton(954, 618, 84, 32, 'Salvar', () => {
      this.state.save();
      this.lastStatus = 'Jogo salvo.';
    });

    this.createButton(1048, 618, 84, 32, 'Reset', () => {
      this.state.reset();
      this.selectedMachineId = null;
      this.lastStatus = 'Progresso resetado.';
      this.syncMachineViews();
    });

    this.statusText = this.add.text(954, 660, '', {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: '#facc15',
      wordWrap: { width: 280 }
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

      const built = this.state.placeMachine(this.state.data.selectedBuild, cell.x, cell.y);
      this.lastStatus = built ? 'Maquina instalada.' : 'Nao foi possivel construir aqui.';
      this.syncMachineViews();
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
      this.lastStatus = `Bloqueado. Junte R$ ${MACHINE_CATALOG[type].unlockCash}.`;
      return;
    }

    if (this.state.data.cash < MACHINE_CATALOG[type].cost) {
      this.lastStatus = `Dinheiro insuficiente. Custa R$ ${MACHINE_CATALOG[type].cost}.`;
      return;
    }

    this.state.data.selectedBuild = this.state.data.selectedBuild === type ? null : type;
    this.selectedMachineId = null;
    this.lastStatus = this.state.data.selectedBuild ? `Construindo: ${MACHINE_CATALOG[type].name}.` : 'Construcao cancelada.';
  }

  private selectMachine(machine: MachineState, upgrade: boolean) {
    this.selectedMachineId = machine.id;
    this.state.data.selectedBuild = null;

    const definition = MACHINE_CATALOG[machine.type];
    const cost = getUpgradeCost(machine.type, machine.level);

    if (upgrade) {
      const ok = this.state.upgradeMachine(machine.id, cost);
      this.lastStatus = ok ? `${definition.name} evoluiu para nivel ${machine.level}.` : `Upgrade custa R$ ${cost}.`;
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
      this.lastStatus = 'Nada para vender.';
      return;
    }

    this.state.data.cash += revenue;
    this.state.data.totalSold += revenue;
    this.state.data.reputation += Math.max(1, Math.floor(revenue / 250));
    this.state.save();
    this.lastStatus = `Venda realizada: R$ ${Math.floor(revenue).toLocaleString('pt-BR')}.`;
  }

  private syncMachineViews() {
    for (const view of this.machineViews.values()) {
      view.container.destroy();
    }

    this.machineViews.clear();

    for (const machine of this.state.data.machines) {
      const definition = MACHINE_CATALOG[machine.type];
      const x = GRID.originX + machine.x * GRID.cell + GRID.cell / 2;
      const y = GRID.originY + machine.y * GRID.cell + GRID.cell / 2;

      const base = this.add.rectangle(0, 0, 42, 42, definition.color, 0.95).setStrokeStyle(2, 0xe2e8f0);
      const label = this.add.text(0, -8, definition.shortName.slice(0, 3).toUpperCase(), {
        fontFamily: 'Arial',
        fontSize: '10px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5);
      const level = this.add.text(0, 8, `Nv.${machine.level}`, {
        fontFamily: 'Arial',
        fontSize: '10px',
        color: '#e2e8f0'
      }).setOrigin(0.5);
      const back = this.add.rectangle(0, 27, 42, 5, 0x0f172a).setOrigin(0.5);
      const progress = this.add.rectangle(-21, 27, 0, 5, 0x22c55e).setOrigin(0, 0.5);
      const status = this.add.text(0, 36, '', {
        fontFamily: 'Arial',
        fontSize: '9px',
        color: '#cbd5e1'
      }).setOrigin(0.5);

      const container = this.add.container(x, y, [base, label, level, back, progress, status]);
      this.machineViews.set(machine.id, { container, progress, status, level });
    }
  }

  private updateMachineViews() {
    for (const machine of this.state.data.machines) {
      const view = this.machineViews.get(machine.id);
      if (!view) continue;

      view.container.setScale(this.selectedMachineId === machine.id ? 1.08 : 1);
      view.progress.width = Math.max(0, Math.min(42, machine.progress * 42));
      view.level.setText(`Nv.${machine.level}`);

      if (machine.starved) {
        view.status.setColor('#fb7185');
        view.status.setText('Sem insumo');
      } else if (machine.running) {
        view.status.setColor('#86efac');
        view.status.setText('Produzindo');
      } else {
        view.status.setColor('#cbd5e1');
        view.status.setText('Livre');
      }
    }
  }

  private updateHud() {
    this.cashText.setText(`R$ ${Math.floor(this.state.data.cash).toLocaleString('pt-BR')}`);
    this.inventoryText.setText(ITEM_ORDER.map((item) => `${ITEM_CATALOG[item].name}: ${Math.floor(this.state.data.inventory[item])}`).join('   '));
    this.statusText.setText(this.lastStatus);
  }

  private createButton(x: number, y: number, width: number, height: number, text: string, onClick: () => void) {
    const background = this.add.rectangle(0, 0, width, height, 0x1e293b).setOrigin(0).setStrokeStyle(1, 0x334155);
    const label = this.add.text(width / 2, height / 2, text, {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: width - 14 }
    }).setOrigin(0.5);

    const button = this.add.container(x, y, [background, label]);
    button.setSize(width, height);
    button.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
    button.on('pointerover', () => background.setFillStyle(0x334155));
    button.on('pointerout', () => background.setFillStyle(0x1e293b));
    button.on('pointerdown', onClick);
  }
}
