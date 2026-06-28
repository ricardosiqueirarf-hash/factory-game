import * as THREE from 'three';
import { MachineType } from '../game/types';

export type MachineModelParts = {
  root: THREE.Group;
  body: THREE.Mesh;
  progress: THREE.Mesh;
  light: THREE.PointLight;
  blade?: THREE.Mesh;
  piston?: THREE.Object3D;
  plate?: THREE.Object3D;
  arm?: THREE.Object3D;
  rollers?: THREE.Object3D[];
  piece?: THREE.Object3D;
};

export function createMachineModel(type: MachineType, color: number): MachineModelParts {
  const root = new THREE.Group();
  const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x0b1322, roughness: 0.35, metalness: 0.85 });
  const bodyMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.72, emissive: color, emissiveIntensity: 0.18 });
  const whiteMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.55, emissive: 0x7bbcff, emissiveIntensity: 0.08 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.44, metalness: 0.8 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.22, 1.95), baseMaterial);
  base.position.y = 0.11;
  root.add(base);

  let body: THREE.Mesh;
  const parts: Partial<MachineModelParts> = {};

  if (type === 'manual_bench') {
    body = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.18, 1.05), bodyMaterial);
    body.position.y = 0.78;
    const legGeometry = new THREE.BoxGeometry(0.12, 0.62, 0.12);
    for (const x of [-0.62, 0.62]) for (const z of [-0.38, 0.38]) {
      const leg = new THREE.Mesh(legGeometry, darkMaterial);
      leg.position.set(x, 0.42, z);
      root.add(leg);
    }
    const toolBox = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.24, 0.34), whiteMaterial);
    toolBox.position.set(-0.42, 1.0, -0.1);
    const rollerA = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.0, 16), whiteMaterial);
    const rollerB = rollerA.clone();
    rollerA.rotation.z = Math.PI / 2;
    rollerB.rotation.z = Math.PI / 2;
    rollerA.position.set(0.26, 1.02, -0.26);
    rollerB.position.set(0.26, 1.02, 0.18);
    parts.rollers = [rollerA, rollerB];
    root.add(body, toolBox, rollerA, rollerB);
  } else if (type === 'cutter') {
    body = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.34, 0.86), bodyMaterial);
    body.position.y = 0.62;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.12, 0.18), whiteMaterial);
    rail.position.set(0, 1.0, -0.28);
    const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 32), new THREE.MeshStandardMaterial({ color: 0xe8f2ff, roughness: 0.18, metalness: 0.92 }));
    blade.rotation.x = Math.PI / 2;
    blade.position.set(0.24, 1.13, -0.28);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.18), darkMaterial);
    arm.position.set(0.24, 0.92, -0.28);
    const piece = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.38), whiteMaterial);
    piece.position.set(-0.2, 1.03, 0.08);
    parts.blade = blade;
    parts.piece = piece;
    root.add(body, rail, arm, blade, piece);
  } else if (type === 'press') {
    body = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.35, 1.05), bodyMaterial);
    body.position.y = 0.5;
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.28, 1.15), bodyMaterial);
    top.position.y = 1.82;
    const columnGeometry = new THREE.BoxGeometry(0.16, 1.28, 0.16);
    for (const x of [-0.58, 0.58]) for (const z of [-0.42, 0.42]) {
      const column = new THREE.Mesh(columnGeometry, darkMaterial);
      column.position.set(x, 1.15, z);
      root.add(column);
    }
    const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.68, 18), whiteMaterial);
    piston.position.set(0, 1.45, 0);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.14, 0.72), whiteMaterial);
    plate.position.set(0, 1.08, 0);
    parts.piston = piston;
    parts.plate = plate;
    root.add(body, top, piston, plate);
  } else {
    body = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.35, 1.3), bodyMaterial);
    body.position.y = 0.55;
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.5, 18), darkMaterial);
    pedestal.position.y = 0.98;
    const arm = new THREE.Group();
    arm.position.y = 1.3;
    const armA = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.92), whiteMaterial);
    armA.position.z = -0.36;
    const joint = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), bodyMaterial);
    const claw = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.18), whiteMaterial);
    claw.position.set(0, -0.12, -0.86);
    arm.add(armA, joint, claw);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.32), darkMaterial);
    belt.position.set(0, 0.83, 0.38);
    const piece = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.26), whiteMaterial);
    piece.position.set(-0.54, 0.96, 0.38);
    parts.arm = arm;
    parts.piece = piece;
    root.add(body, pedestal, arm, belt, piece);
  }

  const progress = new THREE.Mesh(new THREE.BoxGeometry(1, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: 0xd9f4ff }));
  progress.position.set(-0.5, 0.34, -1.05);
  progress.scale.x = 0.01;
  const light = new THREE.PointLight(color, 0.9, 5);
  light.position.set(0, 2.05, 0);
  root.add(progress, light);
  root.traverse((object: THREE.Object3D) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  return { root, body, progress, light, ...parts };
}

export function animateMachineModel(parts: MachineModelParts, progress: number, running: boolean, elapsed: number): void {
  const activity = running ? 1 : 0.18;
  if (parts.blade) parts.blade.rotation.z += 0.18 * activity;
  if (parts.rollers) for (const roller of parts.rollers) roller.rotation.x += 0.07 * activity;
  if (parts.piston && parts.plate) {
    const motion = running ? Math.abs(Math.sin(progress * Math.PI)) : 0;
    parts.piston.position.y = 1.45 - motion * 0.28;
    parts.plate.position.y = 1.08 - motion * 0.42;
  }
  if (parts.arm) {
    parts.arm.rotation.y = Math.sin(elapsed * 2.4) * 0.55 * activity;
    parts.arm.rotation.x = Math.sin(elapsed * 3.2) * 0.18 * activity;
  }
  if (parts.piece) {
    parts.piece.visible = running;
    parts.piece.position.x = -0.55 + progress * 1.1;
    parts.piece.rotation.y += 0.035 * activity;
  }
}
