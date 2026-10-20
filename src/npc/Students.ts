import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";

import "@babylonjs/core/Meshes/Builders/capsuleBuilder";

import { LOOK, STUDENTS, WORLD } from "../config";
import type { BuiltLevel } from "../level/LevelBuilder";

interface Student {
  mesh: Mesh;
  /** Pocetak rute. */
  from: Vector3;
  /** Kraj rute; kod onih koji stoje jednak je pocetku. */
  to: Vector3;
  /** Napredak po ruti u [0, 1]. */
  progress: number;
  /** Smjer kretanja po ruti: 1 prema kraju, -1 prema pocetku. */
  direction: 1 | -1;
  speed: number;
  /** Koliko jos sekundi ovaj student ne moze ponovno usporiti igraca. */
  cooldown: number;
  /** Faza njihanja da svi ne hodaju u istom ritmu. */
  phase: number;
}

/** Studenti koji hodaju hodnicima i usporavaju igraca. */
export class Students {
  private readonly root: TransformNode;
  private readonly students: Student[] = [];
  private readonly materials: StandardMaterial[] = [];

  constructor(
    private readonly scene: Scene,
    private readonly level: BuiltLevel,
  ) {
    this.root = new TransformNode("studenti", scene);
    this.materials = createPalette(scene);
    this.spawn();
  }

  /** Pomice studente i javlja je li netko upravo udario u igraca. */
  update(dt: number, playerPosition: Vector3): boolean {
    let hit = false;

    for (const s of this.students) {
      if (s.cooldown > 0) s.cooldown -= dt;

      const routeLength = Vector3.Distance(s.from, s.to);
      if (routeLength > 0.01) {
        s.progress += (s.direction * s.speed * dt) / routeLength;
        if (s.progress >= 1) {
          s.progress = 1;
          s.direction = -1;
        } else if (s.progress <= 0) {
          s.progress = 0;
          s.direction = 1;
        }
        Vector3.LerpToRef(s.from, s.to, s.progress, s.mesh.position);

        // Okreni lik u smjeru hoda.
        const heading = s.direction === 1 ? s.to.subtract(s.from) : s.from.subtract(s.to);
        s.mesh.rotation.y = Math.atan2(heading.x, heading.z);
      }

      // Lagano njihanje da ne izgledaju kao stupovi.
      const t = performance.now() * 0.001;
      s.mesh.position.y =
        STUDENTS.HEIGHT / 2 + (routeLength > 0.01 ? Math.sin(t * 7 + s.phase) * 0.035 : 0);

      if (s.cooldown <= 0 && horizontalDistance(s.mesh.position, playerPosition) < STUDENTS.HIT_DISTANCE) {
        s.cooldown = STUDENTS.HIT_COOLDOWN_S;
        hit = true;
      }
    }

    return hit;
  }

  /** Brise sve studente i stvara novu postavu; zove se na restart. */
  respawn(): void {
    for (const s of this.students) s.mesh.dispose();
    this.students.length = 0;
    this.spawn();
  }

  dispose(): void {
    for (const s of this.students) s.mesh.dispose();
    this.students.length = 0;
    for (const m of this.materials) m.dispose();
    this.root.dispose();
  }

  private spawn(): void {
    const spots = shuffle([...this.level.studentSpots]);
    const count = randomInt(STUDENTS.MIN_COUNT, STUDENTS.MAX_COUNT);
    const idleCount = Math.round(count * STUDENTS.IDLE_RATIO);

    for (let i = 0; i < count; i++) {
      // Kad ponestane oznacenih mjesta, krecemo ispocetka s malim pomakom.
      const spot = spots[i % spots.length];
      const jitter = i >= spots.length ? randomOffset(WORLD.CELL_SIZE * 0.35) : Vector3.Zero();
      const origin = spot.add(jitter);

      const isIdle = i < idleCount;
      const route = isIdle ? { from: origin, to: origin } : this.findRoute(origin);

      this.students.push(this.createStudent(route.from, route.to));
    }
  }

  private createStudent(from: Vector3, to: Vector3): Student {
    const mesh = MeshBuilder.CreateCapsule(
      "student",
      {
        height: STUDENTS.HEIGHT,
        radius: STUDENTS.RADIUS,
        tessellation: 10,
        subdivisions: 1,
      },
      this.scene,
    );
    mesh.material = this.materials[randomInt(0, this.materials.length - 1)];
    mesh.position.copyFrom(from);
    mesh.position.y = STUDENTS.HEIGHT / 2;
    // Studenti ne blokiraju prolaz, pa namjerno nemaju checkCollisions.
    mesh.checkCollisions = false;
    mesh.isPickable = false;
    mesh.parent = this.root;

    return {
      mesh,
      from: from.clone(),
      to: to.clone(),
      progress: Math.random(),
      direction: Math.random() < 0.5 ? 1 : -1,
      speed: STUDENTS.MIN_SPEED + Math.random() * (STUDENTS.MAX_SPEED - STUDENTS.MIN_SPEED),
      cooldown: 0,
      phase: Math.random() * Math.PI * 2,
    };
  }

  /**
   * Trazi najduzi ravni prohodni potez iz zadane tocke. Ruta nikad ne izlazi
   * iz hodnika, pa studenti ne mogu prosetati kroz zid.
   */
  private findRoute(origin: Vector3): { from: Vector3; to: Vector3 } {
    const cell = WORLD.CELL_SIZE;
    const directions: Array<[number, number]> = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    let bestDir: [number, number] = [0, 0];
    let bestSteps = 0;

    for (const [dx, dz] of shuffle(directions)) {
      let steps = 0;
      while (steps < STUDENTS.MAX_PATROL_CELLS) {
        const nx = origin.x + dx * cell * (steps + 1);
        const nz = origin.z + dz * cell * (steps + 1);
        if (!this.level.isWalkableAt(nx, nz)) break;
        steps++;
      }
      if (steps > bestSteps) {
        bestSteps = steps;
        bestDir = [dx, dz];
      }
    }

    if (bestSteps < 2) return { from: origin, to: origin };

    const to = new Vector3(
      origin.x + bestDir[0] * cell * bestSteps,
      origin.y,
      origin.z + bestDir[1] * cell * bestSteps,
    );
    return { from: origin, to };
  }
}

/** Nekoliko nasumicnih boja jakni; dijele se medu studentima radi performansi. */
function createPalette(scene: Scene): StandardMaterial[] {
  const hexes = ["#c7513f", "#3f72c7", "#4fa36b", "#c79a3f", "#8a4fc7", "#3fb3c7", "#b8536f"];
  return hexes.map((hex, i) => {
    const mat = new StandardMaterial(`matStudent${i}`, scene);
    mat.diffuseColor = Color3.FromHexString(hex);
    mat.specularColor = new Color3(0.05, 0.05, 0.05);
    mat.maxSimultaneousLights = LOOK.MAX_LIGHTS;
    mat.freeze();
    return mat;
  });
}

function horizontalDistance(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomOffset(amount: number): Vector3 {
  return new Vector3((Math.random() - 0.5) * 2 * amount, 0, (Math.random() - 0.5) * 2 * amount);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
