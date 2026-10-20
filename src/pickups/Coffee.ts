import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";

import "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import "@babylonjs/core/Meshes/Builders/torusBuilder";

import { COFFEE, LOOK } from "../config";
import type { BuiltLevel } from "../level/LevelBuilder";

interface Cup {
  mesh: Mesh;
  /** Pocetna visina oko koje salica lebdi. */
  baseY: number;
  /** Faza lebdenja da sve salice ne idu u istom ritmu. */
  phase: number;
  taken: boolean;
}

/** Salice kave koje ubrzavaju igraca. */
export class Coffee {
  private readonly root: TransformNode;
  private readonly cups: Cup[] = [];
  private readonly cupMaterial: StandardMaterial;
  private readonly brewMaterial: StandardMaterial;
  private elapsed = 0;

  constructor(scene: Scene, level: BuiltLevel) {
    this.root = new TransformNode("kave", scene);

    this.cupMaterial = new StandardMaterial("matSalica", scene);
    this.cupMaterial.diffuseColor = Color3.FromHexString("#f4f1ea");
    this.cupMaterial.emissiveColor = new Color3(0.18, 0.16, 0.12);
    this.cupMaterial.specularColor = new Color3(0.3, 0.3, 0.3);

    this.brewMaterial = new StandardMaterial("matKava", scene);
    this.brewMaterial.diffuseColor = Color3.FromHexString("#43250f");
    this.brewMaterial.emissiveColor = new Color3(0.12, 0.06, 0.02);
    this.brewMaterial.specularColor = Color3.Black();
    this.cupMaterial.maxSimultaneousLights = LOOK.MAX_LIGHTS;
    this.brewMaterial.maxSimultaneousLights = LOOK.MAX_LIGHTS;

    for (const spot of level.coffeeSpots) {
      this.cups.push(this.createCup(scene, spot));
    }
  }

  /** Vrti i lebdi salice; vraca broj upravo pokupljenih. */
  update(dt: number, playerPosition: Vector3): number {
    this.elapsed += dt;
    let collected = 0;

    for (const cup of this.cups) {
      if (cup.taken) continue;

      cup.mesh.rotation.y += COFFEE.SPIN_SPEED * dt;
      cup.mesh.position.y =
        cup.baseY + Math.sin(this.elapsed * COFFEE.BOB_SPEED + cup.phase) * COFFEE.BOB_AMPLITUDE;

      if (horizontalDistance(cup.mesh.position, playerPosition) < COFFEE.PICKUP_DISTANCE) {
        cup.taken = true;
        cup.mesh.setEnabled(false);
        collected++;
      }
    }

    return collected;
  }

  /** Vraca sve salice na mjesto; zove se na restart. */
  reset(): void {
    for (const cup of this.cups) {
      cup.taken = false;
      cup.mesh.setEnabled(true);
    }
  }

  dispose(): void {
    for (const cup of this.cups) cup.mesh.dispose();
    this.cups.length = 0;
    this.cupMaterial.dispose();
    this.brewMaterial.dispose();
    this.root.dispose();
  }

  /** Salica je valjak, povrsina kave disk, a drska torus. */
  private createCup(scene: Scene, spot: Vector3): Cup {
    const body = MeshBuilder.CreateCylinder(
      "salica",
      { height: 0.26, diameterTop: 0.26, diameterBottom: 0.19, tessellation: 14 },
      scene,
    );
    body.material = this.cupMaterial;

    const brew = MeshBuilder.CreateCylinder(
      "povrsinaKave",
      { height: 0.01, diameter: 0.23, tessellation: 14 },
      scene,
    );
    brew.material = this.brewMaterial;
    brew.position.y = 0.1;
    brew.parent = body;

    const handle = MeshBuilder.CreateTorus(
      "drska",
      { diameter: 0.17, thickness: 0.035, tessellation: 10 },
      scene,
    );
    handle.material = this.cupMaterial;
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0.14, 0.01, 0);
    handle.parent = body;

    const baseY = spot.y + COFFEE.HOVER_HEIGHT;
    body.position.set(spot.x, baseY, spot.z);
    body.rotation.x = 0;
    body.isPickable = false;
    body.checkCollisions = false;
    body.parent = this.root;

    return { mesh: body, baseY, phase: Math.random() * Math.PI * 2, taken: false };
  }
}

function horizontalDistance(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}
