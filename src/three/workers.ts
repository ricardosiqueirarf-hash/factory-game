import * as THREE from 'three';

export type WorkerView = {
  group: THREE.Group;
  head: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  carryBox: THREE.Mesh;
  phase: number;
  speed: number;
  assignedIndex: number;
};

export function createWorker(index: number): WorkerView {
  const skin = new THREE.MeshStandardMaterial({ color: 0xf0c7a2, roughness: 0.72, metalness: 0.02 });
  const suit = new THREE.MeshStandardMaterial({ color: index % 2 === 0 ? 0x182a42 : 0x22364d, roughness: 0.65, metalness: 0.12 });
  const helmet = new THREE.MeshStandardMaterial({ color: index % 3 === 0 ? 0xffffff : 0xffd166, roughness: 0.35, metalness: 0.18 });
  const boxMaterial = new THREE.MeshStandardMaterial({ color: 0xb47a38, roughness: 0.75, metalness: 0.05 });

  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.46, 4, 8), suit);
  body.position.y = 0.64;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), skin);
  head.position.y = 1.05;
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), helmet);
  hat.position.y = 1.16;

  const armGeometry = new THREE.BoxGeometry(0.09, 0.42, 0.09);
  const leftArm = new THREE.Mesh(armGeometry, suit);
  const rightArm = new THREE.Mesh(armGeometry, suit);
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.1), suit);
  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.1), suit);
  leftArm.position.set(-0.23, 0.66, 0);
  rightArm.position.set(0.23, 0.66, 0);
  leftLeg.position.set(-0.08, 0.24, 0);
  rightLeg.position.set(0.08, 0.24, 0);

  const carryBox = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.28), boxMaterial);
  carryBox.position.set(0, 0.68, -0.25);
  group.add(body, head, hat, leftArm, rightArm, leftLeg, rightLeg, carryBox);
  group.scale.setScalar(0.82);
  group.traverse((object: THREE.Object3D) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  return {
    group,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    carryBox,
    phase: index * 0.73,
    speed: 0.85 + (index % 4) * 0.08,
    assignedIndex: index
  };
}

export function animateWorker(worker: WorkerView, target: THREE.Vector3, delta: number, elapsed: number): void {
  const direction = target.clone().sub(worker.group.position);
  direction.y = 0;
  const distance = direction.length();
  if (distance > 0.03) {
    direction.normalize();
    worker.group.position.addScaledVector(direction, Math.min(distance, delta * worker.speed * 2.1));
    worker.group.rotation.y = Math.atan2(direction.x, direction.z);
  }

  const walk = Math.sin(elapsed * 8 * worker.speed + worker.phase);
  worker.group.position.y = Math.abs(walk) * 0.035;
  worker.leftArm.rotation.x = walk * 0.55;
  worker.rightArm.rotation.x = -walk * 0.55;
  worker.leftLeg.rotation.x = -walk * 0.5;
  worker.rightLeg.rotation.x = walk * 0.5;
  worker.head.rotation.y = Math.sin(elapsed * 2 + worker.phase) * 0.14;
}
