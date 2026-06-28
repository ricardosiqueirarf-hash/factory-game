import * as THREE from 'three';
import { GRID, ITEM_CATALOG, ITEM_ORDER, MACHINE_CATALOG, MACHINE_ORDER, getMachineSpeedMultiplier, getUpgradeCost } from '../game/data/catalog';
import { GameState } from '../game/state/GameState';
import { FactorySimulator } from '../game/systems/FactorySimulator';
import { getDreSnapshot, recordSaleWithTaxes } from '../game/systems/FinanceSimulator';
import { ItemType, MachineState, MachineType } from '../game/types';
import { MachineModelParts, animateMachineModel, createMachineModel } from './machineModels';
import { WorkerView, animateWorker, createWorker } from './workers';

type MachineView = {
  model: MachineModelParts;
};

type Hud = {
  cash: HTMLDivElement;
  inventory: HTMLDivElement;
  production: HTMLDivElement;
  machines: HTMLDivElement;
  dre: HTMLDivElement;
  selected: HTMLDivElement;
  status: HTMLDivElement;
  buttons: Map<MachineType, HTMLButtonElement>;
};

const CELL_SIZE = 2.15;
const WORKER_COUNT = 9;

export class FactoryThreeAppV2 {
  private readonly state = GameState.load();
  private readonly simulator = new FactorySimulator(this.state);
  private readonly scene = new THREE.Scene();
  private readonly clock = new THREE.Clock();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: THREE.OrthographicCamera;
  private readonly hud: Hud;
  private readonly machineViews = new Map<string, MachineView>();
  private readonly machineObjects: THREE.Object3D[] = [];
  private readonly workers: WorkerView[] = [];
  private selectedMachineId: string | null = null;
  private statusMessage = 'Fabrica 3D viva online. Cresca sem quebrar: acompanhe caixa, DRE e gargalos.';
  private saveTimer = 0;
  private elapsed = 0;

  constructor(private readonly root: HTMLElement) {
    this.root.innerHTML = '';
    this.root.className = 'three-root';

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.root.appendChild(this.renderer.domElement);

    this.camera = new THREE.OrthographicCamera(-18, 18, 10, -10, 0.1, 1000);
    this.camera.position.set(22, 20, 22);
    this.camera.lookAt(0, 0, 0);

    this.hud = this.createHud();
    this.createWorld();
    this.createFactoryProps();
    this.createWorkers();
    this.syncMachines();
    this.resize();
    this.updateHud();

    window.addEventListener('resize', () => this.resize());
    this.renderer.domElement.addEventListener('pointerdown', (event: PointerEvent) => this.handlePointer(event));
  }

  start(): void {
    this.loop();
  }

  private createWorld(): void {
    this.scene.background = new THREE.Color(0x05070d);
    this.scene.fog = new THREE.Fog(0x05070d, 34, 76);
    this.scene.add(new THREE.AmbientLight(0xd9f4ff, 0.55));

    const sun = new THREE.DirectionalLight(0xffffff, 2.25);
    sun.position.set(16, 24, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    this.scene.add(sun);

    const blueLight = new THREE.PointLight(0x67c7ff, 4.4, 52);
    blueLight.position.set(-16, 10, -14);
    this.scene.add(blueLight);

    const width = GRID.cols * CELL_SIZE;
    const depth = GRID.rows * CELL_SIZE;
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(width + 2.6, 0.35, depth + 2.6),
      new THREE.MeshStandardMaterial({ color: 0x07111f, roughness: 0.42, metalness: 0.72 })
    );
    floor.position.y = -0.22;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const grid = new THREE.GridHelper(Math.max(width, depth) + 2.4, Math.max(GRID.cols, GRID.rows), 0xe9fbff, 0x1d3d60);
    grid.position.y = 0.02;
    const gridMaterial = grid.material as THREE.Material | THREE.Material[];
    const applyGridOpacity = (material: THREE.Material) => {
      material.transparent = true;
      material.opacity = 0.34;
    };
    if (Array.isArray(gridMaterial)) gridMaterial.forEach(applyGridOpacity);
    else applyGridOpacity(gridMaterial);
    this.scene.add(grid);

    const railMaterial = new THREE.MeshStandardMaterial({ color: 0xd9f4ff, emissive: 0x245d88, emissiveIntensity: 1.3, metalness: 0.8, roughness: 0.25 });
    this.addRail(width + 3, 0.08, 0.08, 0, depth / 2 + 1.35, railMaterial);
    this.addRail(width + 3, 0.08, 0.08, 0, -depth / 2 - 1.35, railMaterial);
    this.addRail(0.08, 0.08, depth + 3, -width / 2 - 1.35, 0, railMaterial);
    this.addRail(0.08, 0.08, depth + 3, width / 2 + 1.35, 0, railMaterial);
  }

  private createFactoryProps(): void {
    const metal = new THREE.MeshStandardMaterial({ color: 0x162235, roughness: 0.36, metalness: 0.82 });
    const crateMaterial = new THREE.MeshStandardMaterial({ color: 0x9b6a32, roughness: 0.75, metalness: 0.05 });
    const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xd9f4ff });

    for (let i = 0; i < 10; i += 1) {
      const height = 1.6 + (i % 3) * 0.42;
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.38, height, 0.38), metal);
      tower.position.set(-19 + i * 4.1, height / 2 - 0.08, -16.5 - (i % 2) * 1.8);
      tower.castShadow = true;
      tower.receiveShadow = true;
      this.scene.add(tower);
    }

    const propCells = [{ x: 0, y: 0 }, { x: 2, y: 10 }, { x: 15, y: 1 }, { x: 17, y: 9 }, { x: 7, y: 11 }, { x: 11, y: 0 }];
    for (const [index, cell] of propCells.entries()) {
      const pallet = new THREE.Group();
      pallet.position.copy(this.cellToWorld(cell.x, cell.y));
      pallet.position.y = 0.06;
      const slatA = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.12, 0.18), crateMaterial);
      const slatB = slatA.clone();
      slatA.position.z = -0.32;
      slatB.position.z = 0.32;
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.48, 0.72), crateMaterial);
      box.position.y = 0.34;
      box.rotation.y = index * 0.35;
      pallet.add(slatA, slatB, box);
      pallet.traverse((object: THREE.Object3D) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      this.scene.add(pallet);
    }

    for (let i = 0; i < 12; i += 1) {
      const marker = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.035, 0.06), lightMaterial);
      marker.position.set(-18 + i * 3.1, 0.045, 14.8);
      this.scene.add(marker);
    }
  }

  private addRail(width: number, height: number, depth: number, x: number, z: number, material: THREE.Material): void {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    rail.position.set(x, 0.08, z);
    this.scene.add(rail);
  }

  private createWorkers(): void {
    for (let i = 0; i < WORKER_COUNT; i += 1) {
      const worker = createWorker(i);
      worker.group.position.set(-8 + i * 1.8, 0, 8 + Math.sin(i) * 2);
      this.workers.push(worker);
      this.scene.add(worker.group);
    }
  }

  private createHud(): Hud {
    const hud = document.createElement('div');
    hud.className = 'hud';
    this.root.appendChild(hud);
    const top = document.createElement('div');
    top.className = 'hud-top';
    top.innerHTML = '<div><strong>NEO FACTORY 3D</strong><span>DRE + caixa + producao</span></div>';
    const cash = document.createElement('div');
    cash.className = 'cash-readout';
    top.appendChild(cash);
    hud.appendChild(top);
    const inventory = document.createElement('div');
    inventory.className = 'inventory-strip';
    hud.appendChild(inventory);
    const panel = document.createElement('aside');
    panel.className = 'command-panel';
    panel.innerHTML = '<h1>Command Center</h1><p>Simulador de gestao: produza, venda, invista e acompanhe a DRE para crescer sem quebrar.</p>';
    hud.appendChild(panel);

    const actions = document.createElement('div');
    actions.className = 'action-row';
    actions.append(this.createButton('Comprar metal x10', () => this.buyMetal()), this.createButton('Vender tudo', () => this.sellAll()));
    panel.appendChild(actions);
    const title = document.createElement('h2');
    title.textContent = 'Maquinas';
    panel.appendChild(title);
    const buttons = new Map<MachineType, HTMLButtonElement>();
    const buildGrid = document.createElement('div');
    buildGrid.className = 'build-grid';
    for (const type of MACHINE_ORDER) {
      const button = this.createButton(MACHINE_CATALOG[type].shortName, () => this.selectBuild(type));
      button.classList.add('machine-button');
      buttons.set(type, button);
      buildGrid.appendChild(button);
    }
    panel.appendChild(buildGrid);
    const production = this.createMetricCard(panel, 'Producao/min');
    const machines = this.createMetricCard(panel, 'Parque fabril');
    const dre = this.createMetricCard(panel, 'DRE gerencial');
    const selected = this.createMetricCard(panel, 'Selecionada');
    const status = document.createElement('div');
    status.className = 'status-console';
    hud.appendChild(status);
    return { cash, inventory, production, machines, dre, selected, status, buttons };
  }

  private createMetricCard(parent: HTMLElement, title: string): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'metric-card';
    const heading = document.createElement('h2');
    heading.textContent = title;
    const body = document.createElement('div');
    body.className = 'metric-body';
    card.append(heading, body);
    parent.appendChild(card);
    return body;
  }

  private createButton(label: string, action: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', action);
    return button;
  }

  private loop = (): void => {
    const delta = this.clock.getDelta();
    this.elapsed += delta;
    const events = this.simulator.tick(delta);
    const unlocked = this.state.unlockAvailableMachines();
    if (events.length > 0) this.statusMessage = events[events.length - 1].message;
    if (unlocked.length > 0) this.statusMessage = `Nova maquina liberada: ${unlocked.map((type) => MACHINE_CATALOG[type].shortName).join(', ')}.`;
    this.saveTimer += delta;
    if (this.saveTimer >= 8) {
      this.saveTimer = 0;
      this.state.save();
    }
    this.updateMachines();
    this.updateWorkers(delta);
    this.updateHud();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.loop);
  };

  private resize(): void {
    const width = this.root.clientWidth || window.innerWidth;
    const height = this.root.clientHeight || window.innerHeight;
    const aspect = width / height;
    const viewHeight = 23;
    const viewWidth = viewHeight * aspect;
    this.camera.left = -viewWidth / 2;
    this.camera.right = viewWidth / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private handlePointer(event: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.machineObjects, true)[0];
    if (hit) {
      const machineId = this.findMachineId(hit.object);
      const machine = this.state.data.machines.find((item) => item.id === machineId);
      if (machine) {
        this.selectMachine(machine, event.shiftKey);
        return;
      }
    }
    const point = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.floorPlane, point);
    const cell = this.worldToCell(point.x, point.z);
    if (!cell || !this.state.data.selectedBuild) return;
    const type = this.state.data.selectedBuild;
    const built = this.state.placeMachine(type, cell.x, cell.y);
    this.statusMessage = built ? `${MACHINE_CATALOG[type].name} instalada no setor ${cell.x + 1}.${cell.y + 1}.` : 'Nao foi possivel construir nesse setor.';
    this.syncMachines();
  }

  private findMachineId(object: THREE.Object3D): string | undefined {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (typeof current.userData.machineId === 'string') return current.userData.machineId;
      current = current.parent;
    }
    return undefined;
  }

  private buyMetal(): void {
    const ok = this.state.buyMetal(10);
    this.statusMessage = ok ? 'Compra registrada na DRE: materia-prima +10 metal bruto.' : 'Saldo insuficiente para comprar metal.';
  }

  private sellAll(): void {
    let grossRevenue = 0;
    for (const item of ITEM_ORDER) {
      if (item === 'metal_ore') continue;
      const qty = this.state.data.inventory[item];
      grossRevenue += qty * ITEM_CATALOG[item].salePrice;
      this.state.data.inventory[item] = 0;
    }
    if (grossRevenue <= 0) {
      this.statusMessage = 'Nenhum produto acabado para vender.';
      return;
    }
    const netRevenue = recordSaleWithTaxes(this.state, grossRevenue);
    this.state.save();
    this.statusMessage = `Venda registrada na DRE. Bruto R$ ${Math.floor(grossRevenue).toLocaleString('pt-BR')} | Liquido R$ ${Math.floor(netRevenue).toLocaleString('pt-BR')}.`;
  }

  private selectBuild(type: MachineType): void {
    const def = MACHINE_CATALOG[type];
    if (!this.state.data.unlockedMachines.includes(type)) {
      this.statusMessage = `Modulo bloqueado. Alcance R$ ${def.unlockCash}.`;
      return;
    }
    if (this.state.data.cash < def.cost) {
      this.statusMessage = `Saldo insuficiente. ${def.name} custa R$ ${def.cost}.`;
      return;
    }
    this.selectedMachineId = null;
    this.state.data.selectedBuild = this.state.data.selectedBuild === type ? null : type;
    this.statusMessage = this.state.data.selectedBuild ? `Modo construcao 3D: ${def.name}. Clique no piso. Esse investimento entra como CAPEX na DRE.` : 'Construcao cancelada.';
  }

  private selectMachine(machine: MachineState, upgrade: boolean): void {
    this.selectedMachineId = machine.id;
    this.state.data.selectedBuild = null;
    const def = MACHINE_CATALOG[machine.type];
    const cost = getUpgradeCost(machine.type, machine.level);
    if (upgrade) {
      const ok = this.state.upgradeMachine(machine.id, cost);
      this.statusMessage = ok ? `${def.name} atualizada para nivel ${machine.level}. Upgrade entrou na DRE.` : `Upgrade custa R$ ${cost}.`;
      return;
    }
    this.statusMessage = `${def.name} nivel ${machine.level}. Shift + clique para upgrade por R$ ${cost}.`;
  }

  private syncMachines(): void {
    for (const machine of this.state.data.machines) {
      if (!this.machineViews.has(machine.id)) this.createMachine(machine);
    }
  }

  private createMachine(machine: MachineState): void {
    const def = MACHINE_CATALOG[machine.type];
    const model = createMachineModel(machine.type, def.color);
    model.root.position.copy(this.cellToWorld(machine.x, machine.y));
    model.root.userData.machineId = machine.id;
    model.root.traverse((object: THREE.Object3D) => {
      object.userData.machineId = machine.id;
    });
    model.root.scale.setScalar(0.12);
    const start = performance.now();
    const animateBuild = () => {
      const t = Math.min(1, (performance.now() - start) / 380);
      model.root.scale.setScalar(0.12 + (1 - Math.pow(1 - t, 3)) * 0.88);
      if (t < 1) requestAnimationFrame(animateBuild);
    };
    animateBuild();
    this.scene.add(model.root);
    this.machineObjects.push(model.root);
    this.machineViews.set(machine.id, { model });
  }

  private updateMachines(): void {
    for (const machine of this.state.data.machines) {
      const view = this.machineViews.get(machine.id);
      if (!view) continue;
      const pulse = Math.sin(this.elapsed * 5 + machine.x + machine.y) * 0.08;
      view.model.root.scale.setScalar(this.selectedMachineId === machine.id ? 1.08 : 1);
      view.model.progress.scale.x = Math.max(0.01, machine.progress);
      view.model.progress.position.x = -0.5 + machine.progress / 2;
      view.model.light.intensity = machine.running ? 1.4 + Math.abs(pulse) * 2 : machine.starved ? 0.25 : 0.7;
      const material = view.model.body.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = machine.running ? 0.32 + Math.abs(pulse) : machine.starved ? 0.04 : 0.16;
      animateMachineModel(view.model, machine.progress, machine.running, this.elapsed);
    }
  }

  private updateWorkers(delta: number): void {
    const machines = this.state.data.machines;
    for (const worker of this.workers) {
      const target = new THREE.Vector3();
      if (machines.length > 0) {
        const machine = machines[worker.assignedIndex % machines.length];
        const machinePos = this.cellToWorld(machine.x, machine.y);
        const angle = this.elapsed * 0.7 * worker.speed + worker.phase;
        const radius = 1.35 + (worker.assignedIndex % 3) * 0.18;
        target.set(machinePos.x + Math.cos(angle) * radius, 0, machinePos.z + Math.sin(angle) * radius);
        worker.carryBox.visible = machine.running || worker.assignedIndex % 2 === 0;
      } else {
        const angle = this.elapsed * 0.35 * worker.speed + worker.phase;
        target.set(Math.cos(angle) * 9.5, 0, Math.sin(angle * 1.3) * 5.5);
        worker.carryBox.visible = worker.assignedIndex % 2 === 0;
      }
      animateWorker(worker, target, delta, this.elapsed);
    }
  }

  private updateHud(): void {
    this.hud.cash.textContent = `R$ ${Math.floor(this.state.data.cash).toLocaleString('pt-BR')}`;
    this.hud.inventory.innerHTML = ITEM_ORDER.map((item) => `<span>${ITEM_CATALOG[item].name}: <strong>${Math.floor(this.state.data.inventory[item])}</strong></span>`).join('');
    this.hud.production.innerHTML = this.productionHtml();
    this.hud.machines.innerHTML = this.machineHtml();
    this.hud.dre.innerHTML = this.dreHtml();
    this.hud.selected.innerHTML = this.selectedHtml();
    this.hud.status.textContent = this.statusMessage;
    this.updateButtons();
  }

  private updateButtons(): void {
    const counts = this.machineCounts();
    for (const type of MACHINE_ORDER) {
      const btn = this.hud.buttons.get(type);
      if (!btn) continue;
      const def = MACHINE_CATALOG[type];
      const unlocked = this.state.data.unlockedMachines.includes(type);
      btn.disabled = !unlocked;
      btn.classList.toggle('selected', this.state.data.selectedBuild === type);
      btn.innerHTML = `<strong>${def.shortName}</strong><small>${unlocked ? `R$ ${def.cost} | ${counts[type]} un.` : `bloq. R$ ${def.unlockCash}`}</small>`;
    }
  }

  private productionHtml(): string {
    const cap = this.capacityByItem();
    const rows: string[] = [];
    for (const item of ITEM_ORDER) {
      if (item === 'metal_ore') continue;
      const value = cap[item] ?? 0;
      if (value > 0) rows.push(`<p>${ITEM_CATALOG[item].name}<strong>${value.toFixed(1)}/min</strong></p>`);
    }
    const revenue = ITEM_ORDER.reduce((total, item) => item === 'metal_ore' ? total : total + (cap[item] ?? 0) * ITEM_CATALOG[item].salePrice, 0);
    rows.push(`<p>Capacidade bruta<strong>R$ ${Math.floor(revenue).toLocaleString('pt-BR')}/min</strong></p>`);
    return rows.join('');
  }

  private dreHtml(): string {
    const dre = getDreSnapshot(this.state);
    const riskLabel = dre.risk === 'saudavel' ? 'Saudavel' : dre.risk === 'atencao' ? 'Atencao' : dre.risk === 'critico' ? 'Critico' : 'Quebrou';
    const runway = dre.runwayDays > 99 ? '+99 dias' : `${Math.max(0, dre.runwayDays).toFixed(1)} dias`;
    return [
      `<p>Dia simulado<strong>${dre.day}</strong></p>`,
      `<p>Receita liquida<strong>${this.money(dre.revenue)}</strong></p>`,
      `<p>Impostos<strong>${this.money(dre.taxes)}</strong></p>`,
      `<p>Materia-prima<strong>${this.money(dre.materials)}</strong></p>`,
      `<p>Folha + aluguel<strong>${this.money(dre.labor + dre.rent)}</strong></p>`,
      `<p>Energia + manut.<strong>${this.money(dre.energy + dre.maintenance)}</strong></p>`,
      `<p>EBITDA<strong>${this.money(dre.ebitda)}</strong></p>`,
      `<p>CAPEX + upgrades<strong>${this.money(dre.capex + dre.upgrades)}</strong></p>`,
      `<p>Resultado<strong>${this.money(dre.netResult)}</strong></p>`,
      `<p>Margem<strong>${(dre.margin * 100).toFixed(1)}%</strong></p>`,
      `<p>Folego de caixa<strong>${runway}</strong></p>`,
      `<p>Risco<strong>${riskLabel}</strong></p>`
    ].join('');
  }

  private machineHtml(): string {
    const counts = this.machineCounts();
    const rows = [`<p>Total instalado<strong>${this.state.data.machines.length}</strong></p>`, `<p>Workers ativos<strong>${this.workers.length}</strong></p>`];
    for (const type of MACHINE_ORDER) if (counts[type] > 0) rows.push(`<p>${MACHINE_CATALOG[type].shortName}<strong>${counts[type]} un.</strong></p>`);
    return rows.join('');
  }

  private selectedHtml(): string {
    const machine = this.state.data.machines.find((item) => item.id === this.selectedMachineId);
    if (!machine) return '<p>Selecione uma maquina 3D para ver capacidade e upgrade.</p>';
    const def = MACHINE_CATALOG[machine.type];
    const cost = getUpgradeCost(machine.type, machine.level);
    const output = Object.entries(def.output).map(([item, amount]) => `${((Number(amount) * 60 * getMachineSpeedMultiplier(machine.level)) / def.cycleSeconds).toFixed(1)} ${ITEM_CATALOG[item as ItemType].name}/min`).join(' + ');
    return `<p>${def.name}</p><p>Nivel<strong>${machine.level}</strong></p><p>Capacidade<strong>${output}</strong></p><p>Upgrade<strong>R$ ${cost}</strong></p>`;
  }

  private machineCounts(): Record<MachineType, number> {
    const counts = {} as Record<MachineType, number>;
    for (const type of MACHINE_ORDER) counts[type] = 0;
    for (const machine of this.state.data.machines) counts[machine.type] += 1;
    return counts;
  }

  private capacityByItem(): Partial<Record<ItemType, number>> {
    const cap: Partial<Record<ItemType, number>> = {};
    for (const machine of this.state.data.machines) {
      const def = MACHINE_CATALOG[machine.type];
      const mult = getMachineSpeedMultiplier(machine.level);
      for (const [item, amount] of Object.entries(def.output)) cap[item as ItemType] = (cap[item as ItemType] ?? 0) + (Number(amount) * 60 * mult) / def.cycleSeconds;
    }
    return cap;
  }

  private money(value: number): string {
    return `R$ ${Math.floor(value).toLocaleString('pt-BR')}`;
  }

  private cellToWorld(x: number, y: number): THREE.Vector3 {
    return new THREE.Vector3((x - GRID.cols / 2 + 0.5) * CELL_SIZE, 0, (y - GRID.rows / 2 + 0.5) * CELL_SIZE);
  }

  private worldToCell(x: number, z: number): { x: number; y: number } | null {
    const cellX = Math.floor(x / CELL_SIZE + GRID.cols / 2);
    const cellY = Math.floor(z / CELL_SIZE + GRID.rows / 2);
    if (cellX < 0 || cellY < 0 || cellX >= GRID.cols || cellY >= GRID.rows) return null;
    return { x: cellX, y: cellY };
  }
}
