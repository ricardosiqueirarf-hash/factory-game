import * as THREE from 'three';
import { GRID, ITEM_CATALOG, ITEM_ORDER, MACHINE_CATALOG, MACHINE_ORDER, getMachineSpeedMultiplier, getUpgradeCost } from '../game/data/catalog';
import { GameState } from '../game/state/GameState';
import { FactorySimulator } from '../game/systems/FactorySimulator';
import { ItemType, MachineState, MachineType } from '../game/types';

type MachineView = {
  group: THREE.Group;
  body: THREE.Mesh;
  progress: THREE.Mesh;
  light: THREE.PointLight;
};

type Hud = {
  cash: HTMLDivElement;
  inventory: HTMLDivElement;
  production: HTMLDivElement;
  machines: HTMLDivElement;
  selected: HTMLDivElement;
  status: HTMLDivElement;
  buttons: Map<MachineType, HTMLButtonElement>;
};

const CELL_SIZE = 2.15;

export class FactoryThreeApp {
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
  private selectedMachineId: string | null = null;
  private statusMessage = 'Fabrica 3D online. Selecione uma maquina e clique no piso.';
  private saveTimer = 0;

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
    this.syncMachines();
    this.resize();
    this.updateHud();

    window.addEventListener('resize', () => this.resize());
    this.renderer.domElement.addEventListener('pointerdown', (event) => this.handlePointer(event));
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
    if (Array.isArray(gridMaterial)) {
      gridMaterial.forEach((material) => {
        material.transparent = true;
        material.opacity = 0.34;
      });
    } else {
      gridMaterial.transparent = true;
      gridMaterial.opacity = 0.34;
    }
    this.scene.add(grid);

    const railMaterial = new THREE.MeshStandardMaterial({
      color: 0xd9f4ff,
      emissive: 0x245d88,
      emissiveIntensity: 1.3,
      metalness: 0.8,
      roughness: 0.25
    });
    this.addRail(width + 3, 0.08, 0.08, 0, depth / 2 + 1.35, railMaterial);
    this.addRail(width + 3, 0.08, 0.08, 0, -depth / 2 - 1.35, railMaterial);
    this.addRail(0.08, 0.08, depth + 3, -width / 2 - 1.35, 0, railMaterial);
    this.addRail(0.08, 0.08, depth + 3, width / 2 + 1.35, 0, railMaterial);
  }

  private addRail(width: number, height: number, depth: number, x: number, z: number, material: THREE.Material): void {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    rail.position.set(x, 0.08, z);
    this.scene.add(rail);
  }

  private createHud(): Hud {
    const hud = document.createElement('div');
    hud.className = 'hud';
    this.root.appendChild(hud);

    const top = document.createElement('div');
    top.className = 'hud-top';
    top.innerHTML = '<div><strong>NEO FACTORY 3D</strong><span>real three.js industrial tycoon</span></div>';
    const cash = document.createElement('div');
    cash.className = 'cash-readout';
    top.appendChild(cash);
    hud.appendChild(top);

    const inventory = document.createElement('div');
    inventory.className = 'inventory-strip';
    hud.appendChild(inventory);

    const panel = document.createElement('aside');
    panel.className = 'command-panel';
    panel.innerHTML = '<h1>Command Center</h1><p>Construa maquinas 3D, acompanhe producao/min e resolva gargalos.</p>';
    hud.appendChild(panel);

    const actions = document.createElement('div');
    actions.className = 'action-row';
    actions.append(
      this.createButton('Comprar metal x10', () => this.buyMetal()),
      this.createButton('Vender tudo', () => this.sellAll())
    );
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
    const selected = this.createMetricCard(panel, 'Selecionada');

    const status = document.createElement('div');
    status.className = 'status-console';
    hud.appendChild(status);

    return { cash, inventory, production, machines, selected, status, buttons };
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
    const events = this.simulator.tick(delta);
    const unlocked = this.state.unlockAvailableMachines();

    if (events.length > 0) {
      this.statusMessage = events[events.length - 1].message;
    }
    if (unlocked.length > 0) {
      this.statusMessage = `Nova maquina liberada: ${unlocked.map((type) => MACHINE_CATALOG[type].shortName).join(', ')}.`;
    }

    this.saveTimer += delta;
    if (this.saveTimer >= 8) {
      this.saveTimer = 0;
      this.state.save();
    }

    this.updateMachines();
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
    if (!cell || !this.state.data.selectedBuild) {
      return;
    }

    const type = this.state.data.selectedBuild;
    const built = this.state.placeMachine(type, cell.x, cell.y);
    this.statusMessage = built ? `${MACHINE_CATALOG[type].name} instalada no setor ${cell.x + 1}.${cell.y + 1}.` : 'Nao foi possivel construir nesse setor.';
    this.syncMachines();
  }

  private findMachineId(object: THREE.Object3D): string | undefined {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (typeof current.userData.machineId === 'string') {
        return current.userData.machineId;
      }
      current = current.parent;
    }
    return undefined;
  }

  private buyMetal(): void {
    const ok = this.state.buyMetal(10);
    this.statusMessage = ok ? 'Materia-prima comprada: +10 metal bruto.' : 'Saldo insuficiente para comprar metal.';
  }

  private sellAll(): void {
    let revenue = 0;
    for (const item of ITEM_ORDER) {
      if (item === 'metal_ore') continue;
      const qty = this.state.data.inventory[item];
      revenue += qty * ITEM_CATALOG[item].salePrice;
      this.state.data.inventory[item] = 0;
    }
    if (revenue <= 0) {
      this.statusMessage = 'Nenhum produto acabado para vender.';
      return;
    }
    this.state.data.cash += revenue;
    this.state.data.totalSold += revenue;
    this.state.data.reputation += Math.max(1, Math.floor(revenue / 250));
    this.state.save();
    this.statusMessage = `Despacho concluido. Receita: R$ ${Math.floor(revenue).toLocaleString('pt-BR')}.`;
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
    this.statusMessage = this.state.data.selectedBuild ? `Modo construcao 3D: ${def.name}. Clique no piso.` : 'Construcao cancelada.';
  }

  private selectMachine(machine: MachineState, upgrade: boolean): void {
    this.selectedMachineId = machine.id;
    this.state.data.selectedBuild = null;
    const def = MACHINE_CATALOG[machine.type];
    const cost = getUpgradeCost(machine.type, machine.level);
    if (upgrade) {
      const ok = this.state.upgradeMachine(machine.id, cost);
      this.statusMessage = ok ? `${def.name} atualizada para nivel ${machine.level}.` : `Upgrade custa R$ ${cost}.`;
      return;
    }
    this.statusMessage = `${def.name} nivel ${machine.level}. Shift + clique para upgrade por R$ ${cost}.`;
  }

  private syncMachines(): void {
    for (const machine of this.state.data.machines) {
      if (!this.machineViews.has(machine.id)) {
        this.createMachine(machine);
      }
    }
  }

  private createMachine(machine: MachineState): void {
    const def = MACHINE_CATALOG[machine.type];
    const group = new THREE.Group();
    group.position.copy(this.cellToWorld(machine.x, machine.y));
    group.userData.machineId = machine.id;

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.25, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x0b1322, roughness: 0.35, metalness: 0.85 })
    );
    base.position.y = 0.12;

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.12, 1.18, 1.12),
      new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.3, metalness: 0.72, emissive: def.color, emissiveIntensity: 0.18 })
    );
    body.position.y = 0.86;

    const top = new THREE.Mesh(
      new THREE.BoxGeometry(1.34, 0.22, 1.34),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.55, emissive: 0x7bbcff, emissiveIntensity: 0.08 })
    );
    top.position.y = 1.56;

    const bar = new THREE.Mesh(new THREE.BoxGeometry(1, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: 0xd9f4ff }));
    bar.position.set(-0.5, 0.35, -0.95);
    bar.scale.x = 0.01;

    const light = new THREE.PointLight(def.color, 0.9, 5);
    light.position.set(0, 2.05, 0);

    group.add(base, body, top, bar, light);
    group.traverse((obj) => {
      obj.userData.machineId = machine.id;
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    this.scene.add(group);
    this.machineObjects.push(group);
    this.machineViews.set(machine.id, { group, body, progress: bar, light });
  }

  private updateMachines(): void {
    const now = performance.now() / 1000;
    for (const machine of this.state.data.machines) {
      const view = this.machineViews.get(machine.id);
      if (!view) continue;
      const pulse = Math.sin(now * 5 + machine.x + machine.y) * 0.08;
      view.group.rotation.y += machine.running ? 0.008 : 0.002;
      view.group.scale.setScalar(this.selectedMachineId === machine.id ? 1.08 : 1);
      view.progress.scale.x = Math.max(0.01, machine.progress);
      view.progress.position.x = -0.5 + machine.progress / 2;
      view.light.intensity = machine.running ? 1.4 + Math.abs(pulse) * 2 : machine.starved ? 0.25 : 0.7;
      const material = view.body.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = machine.running ? 0.32 + Math.abs(pulse) : machine.starved ? 0.04 : 0.16;
    }
  }

  private updateHud(): void {
    this.hud.cash.textContent = `R$ ${Math.floor(this.state.data.cash).toLocaleString('pt-BR')}`;
    this.hud.inventory.innerHTML = ITEM_ORDER.map((item) => `<span>${ITEM_CATALOG[item].name}: <strong>${Math.floor(this.state.data.inventory[item])}</strong></span>`).join('');
    this.hud.production.innerHTML = this.productionHtml();
    this.hud.machines.innerHTML = this.machineHtml();
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

  private machineHtml(): string {
    const counts = this.machineCounts();
    const rows = [`<p>Total instalado<strong>${this.state.data.machines.length}</strong></p>`];
    for (const type of MACHINE_ORDER) {
      if (counts[type] > 0) rows.push(`<p>${MACHINE_CATALOG[type].shortName}<strong>${counts[type]} un.</strong></p>`);
    }
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
      for (const [item, amount] of Object.entries(def.output)) {
        cap[item as ItemType] = (cap[item as ItemType] ?? 0) + (Number(amount) * 60 * mult) / def.cycleSeconds;
      }
    }
    return cap;
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
