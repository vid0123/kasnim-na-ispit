import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";

import "@babylonjs/core/Meshes/Builders/boxBuilder";
import "@babylonjs/core/Meshes/Builders/groundBuilder";
import "@babylonjs/core/Meshes/Builders/planeBuilder";

import { LOOK, WORLD } from "../config";
import {
  FLOOR_MAP,
  MAP_COLS,
  MAP_ROWS,
  ROOMS,
  SIGNPOSTS,
  START_FACING,
  TILE,
  findTile,
  findTiles,
  isWalkable,
  tileAt,
  type Cell,
  type Facing,
} from "./levelData";

/** Nevidljiva zona na ulazu u dvoranu. */
export interface RoomTrigger {
  label: string;
  /** Srediste zone u svijetu, na visini poda. */
  center: Vector3;
  /** Polumjer zone u metrima. */
  radius: number;
}

/**
 * Sve sto ostatak igre treba znati o katu.
 *
 * Igra nikad ne cita FLOOR_MAP izravno, nego samo ovaj objekt. Kad kat zamijeni
 * .glb iz Blendera, dovoljno je napisati drugu funkciju koja vraca BuiltLevel
 * (npr. buildLevelFromGlb) i zamijeniti poziv u Game.ts. Ostali moduli ostaju isti.
 */
export interface BuiltLevel {
  /** Gdje igrac pocinje, na visini poda. */
  playerStart: Vector3;
  /** Zakret kamere oko osi y na pocetku runde, u radijanima. */
  playerStartYaw: number;
  /** Mjesta na kojima se stvaraju kave. */
  coffeeSpots: Vector3[];
  /** Mjesta na kojima se stvaraju studenti. */
  studentSpots: Vector3[];
  /** Zone na ulazima u dvorane. */
  roomTriggers: RoomTrigger[];
  /** Oznake svih dvorana, redom. */
  roomLabels: string[];
  /** Moze li se stati na tocku u svijetu; koriste NPC-ovi za svoje rute. */
  isWalkableAt(x: number, z: number): boolean;
  /** Gradivni korijen; uklanja svu geometriju kata. */
  root: TransformNode;
  dispose(): void;
}

/** Pretvara stupac mreze u svjetsku x koordinatu (srediste celije). */
export function colToX(col: number): number {
  return (col - MAP_COLS / 2 + 0.5) * WORLD.CELL_SIZE;
}

/** Pretvara redak mreze u svjetsku z koordinatu (srediste celije). */
export function rowToZ(row: number): number {
  return (row - MAP_ROWS / 2 + 0.5) * WORLD.CELL_SIZE;
}

/** Pretvara svjetsku x koordinatu u stupac mreze. */
export function xToCol(x: number): number {
  return Math.floor(x / WORLD.CELL_SIZE + MAP_COLS / 2);
}

/** Pretvara svjetsku z koordinatu u redak mreze. */
export function zToRow(z: number): number {
  return Math.floor(z / WORLD.CELL_SIZE + MAP_ROWS / 2);
}

/** Srediste celije u svijetu, na zadanoj visini. */
export function cellToWorld(cell: Cell, y = 0): Vector3 {
  return new Vector3(colToX(cell.col), y, rowToZ(cell.row));
}

/**
 * Zakret plohe tako da njezino lice gleda u zadani smjer.
 * MeshBuilder.CreatePlane bez zakreta gleda u -z, dakle prema sjeveru.
 */
const SIGN_ROTATION: Record<Facing, number> = {
  n: 0,
  s: Math.PI,
  e: -Math.PI / 2,
  w: Math.PI / 2,
};

/**
 * Zakret kamere da gleda u zadani smjer. Kamera bez zakreta gleda u +z,
 * dakle prema jugu, pa je ovo suprotno od SIGN_ROTATION.
 */
const VIEW_ROTATION: Record<Facing, number> = {
  n: Math.PI,
  s: 0,
  e: Math.PI / 2,
  w: -Math.PI / 2,
};

/** Gradi kat iz mreze znakova u levelData.ts. */
export function buildLevelFromGrid(scene: Scene): BuiltLevel {
  const root = new TransformNode("kat", scene);
  const cell = WORLD.CELL_SIZE;

  const materials = createMaterials(scene);

  buildFloor(scene, root, materials);
  buildWalls(scene, root, materials);
  buildCeiling(scene, root, materials);
  buildNeonLights(scene, root, materials);
  buildDoorFrames(scene, root, materials);
  buildRoomSigns(scene, root);
  buildSignposts(scene, root);

  const start = findTile(TILE.START);
  if (!start) throw new Error("U FLOOR_MAP nedostaje pocetna pozicija 'S'");

  const roomTriggers: RoomTrigger[] = ROOMS.map((room) => ({
    label: room.label,
    center: cellToWorld(room.door),
    radius: cell * 0.5,
  }));

  return {
    playerStart: cellToWorld(start),
    playerStartYaw: VIEW_ROTATION[START_FACING],
    coffeeSpots: findTiles(TILE.COFFEE).map((c) => cellToWorld(c)),
    studentSpots: findTiles(TILE.STUDENT).map((c) => cellToWorld(c)),
    roomTriggers,
    roomLabels: ROOMS.map((r) => r.label),
    isWalkableAt: (x, z) => isWalkable(xToCol(x), zToRow(z)),
    root,
    dispose: () => root.dispose(false, true),
  };
}

interface LevelMaterials {
  wall: StandardMaterial;
  floor: StandardMaterial;
  roomFloor: StandardMaterial;
  ceiling: StandardMaterial;
  neon: StandardMaterial;
  doorFrame: StandardMaterial;
}

function createMaterials(scene: Scene): LevelMaterials {
  const wall = new StandardMaterial("matZid", scene);
  wall.diffuseColor = Color3.FromHexString(LOOK.WALL_COLOR);
  wall.specularColor = new Color3(0.04, 0.04, 0.04);

  const floor = new StandardMaterial("matPod", scene);
  floor.diffuseColor = Color3.FromHexString(LOOK.FLOOR_COLOR);
  floor.specularColor = Color3.Black();

  const roomFloor = new StandardMaterial("matPodDvorane", scene);
  roomFloor.diffuseColor = Color3.FromHexString(LOOK.FLOOR_COLOR).scale(1.35);
  roomFloor.specularColor = Color3.Black();

  const ceiling = new StandardMaterial("matStrop", scene);
  ceiling.diffuseColor = Color3.FromHexString(LOOK.CEILING_COLOR);
  ceiling.specularColor = Color3.Black();
  ceiling.backFaceCulling = false;
  // Strop gleda prema dolje pa ga hemisfericno svjetlo jedva dohvaca;
  // mali emissive udio daje dojam osvijetljenih stropnih ploca.
  ceiling.emissiveColor = Color3.FromHexString(LOOK.CEILING_COLOR).scale(0.42);

  const neon = new StandardMaterial("matNeon", scene);
  neon.diffuseColor = Color3.Black();
  neon.specularColor = Color3.Black();
  neon.emissiveColor = Color3.FromHexString(LOOK.NEON_COLOR);
  neon.disableLighting = true;

  const doorFrame = new StandardMaterial("matDovratnik", scene);
  doorFrame.diffuseColor = Color3.FromHexString(LOOK.DOOR_FRAME_COLOR);
  doorFrame.specularColor = new Color3(0.08, 0.08, 0.08);

  const all = { wall, floor, roomFloor, ceiling, neon, doorFrame };
  for (const material of Object.values(all)) {
    material.maxSimultaneousLights = LOOK.MAX_LIGHTS;
  }
  return all;
}

/** Pod: jedna velika ploha plus spojene plohe dvorana u drugoj nijansi. */
function buildFloor(scene: Scene, root: TransformNode, mats: LevelMaterials): void {
  const cell = WORLD.CELL_SIZE;

  const ground = MeshBuilder.CreateGround(
    "pod",
    { width: MAP_COLS * cell, height: MAP_ROWS * cell },
    scene,
  );
  ground.material = mats.floor;
  ground.checkCollisions = true;
  ground.parent = root;
  ground.freezeWorldMatrix();

  const roomTiles: Mesh[] = [];
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      if (tileAt(col, row) !== TILE.ROOM) continue;
      const tile = MeshBuilder.CreateGround("podDvorane", { width: cell, height: cell }, scene);
      tile.position.set(colToX(col), 0.02, rowToZ(row));
      roomTiles.push(tile);
    }
  }
  const merged = Mesh.MergeMeshes(roomTiles, true, true, undefined, false, false);
  if (merged) {
    merged.name = "podoviDvorana";
    merged.material = mats.roomFloor;
    merged.parent = root;
    merged.freezeWorldMatrix();
  }
}

/**
 * Zidovi. Susjedne celije zida u istom retku spajaju se u jednu kutiju, a
 * kutije se zatim spajaju u nekoliko velikih meshova po regijama kata.
 * Manje meshova znaci i brze crtanje i jeftinije kolizije.
 */
function buildWalls(scene: Scene, root: TransformNode, mats: LevelMaterials): void {
  const cell = WORLD.CELL_SIZE;
  const height = WORLD.WALL_HEIGHT;
  /** Zidovi se spajaju u mrezu regija ove velicine, u celijama. */
  const REGION = 10;

  const chunks = new Map<string, Mesh[]>();

  for (let row = 0; row < MAP_ROWS; row++) {
    let col = 0;
    while (col < MAP_COLS) {
      if (tileAt(col, row) !== TILE.WALL) {
        col++;
        continue;
      }
      // Produlji niz zida dokle god ostaje u istoj regiji.
      const startCol = col;
      const regionCol = Math.floor(col / REGION);
      let endCol = col;
      while (
        endCol + 1 < MAP_COLS &&
        tileAt(endCol + 1, row) === TILE.WALL &&
        Math.floor((endCol + 1) / REGION) === regionCol
      ) {
        endCol++;
      }

      const span = endCol - startCol + 1;
      const box = MeshBuilder.CreateBox(
        "zid",
        { width: span * cell, height, depth: WORLD.WALL_THICKNESS },
        scene,
      );
      box.position.set(
        (colToX(startCol) + colToX(endCol)) / 2,
        height / 2,
        rowToZ(row),
      );

      const key = `${regionCol}:${Math.floor(row / REGION)}`;
      const list = chunks.get(key);
      if (list) list.push(box);
      else chunks.set(key, [box]);

      col = endCol + 1;
    }
  }

  for (const [key, boxes] of chunks) {
    const merged = Mesh.MergeMeshes(boxes, true, true, undefined, false, false);
    if (!merged) continue;
    merged.name = `zidovi_${key}`;
    merged.material = mats.wall;
    merged.checkCollisions = true;
    merged.parent = root;
    merged.freezeWorldMatrix();
  }
}

/** Strop kao jedna ploha nad cijelim katom. */
function buildCeiling(scene: Scene, root: TransformNode, mats: LevelMaterials): void {
  const cell = WORLD.CELL_SIZE;
  const ceiling = MeshBuilder.CreateGround(
    "strop",
    { width: MAP_COLS * cell, height: MAP_ROWS * cell },
    scene,
  );
  ceiling.position.y = WORLD.CEILING_HEIGHT;
  ceiling.rotation.z = Math.PI; // okrenuto prema dolje
  ceiling.material = mats.ceiling;
  ceiling.isPickable = false;
  ceiling.parent = root;
  ceiling.freezeWorldMatrix();
}

/** Neonske cijevi: emissive kutije svakih nekoliko celija u hodnicima. */
function buildNeonLights(scene: Scene, root: TransformNode, mats: LevelMaterials): void {
  const cell = WORLD.CELL_SIZE;
  const tubes: Mesh[] = [];

  for (let row = 2; row < MAP_ROWS; row += 4) {
    for (let col = 2; col < MAP_COLS; col += 4) {
      if (!isWalkable(col, row)) continue;
      const tube = MeshBuilder.CreateBox(
        "neon",
        { width: cell * 1.3, height: 0.08, depth: 0.22 },
        scene,
      );
      tube.position.set(colToX(col), WORLD.CEILING_HEIGHT - 0.12, rowToZ(row));
      tubes.push(tube);
    }
  }

  const merged = Mesh.MergeMeshes(tubes, true, true, undefined, false, false);
  if (!merged) return;
  merged.name = "neonke";
  merged.material = mats.neon;
  merged.isPickable = false;
  merged.parent = root;
  merged.freezeWorldMatrix();
}

/** Dovratnici oko svake celije s vratima. */
function buildDoorFrames(scene: Scene, root: TransformNode, mats: LevelMaterials): void {
  const cell = WORLD.CELL_SIZE;
  const frames: Mesh[] = [];

  for (const room of ROOMS) {
    const { col, row } = room.door;
    const along = doorAxis(room.door);
    const x = colToX(col);
    const z = rowToZ(row);

    // Dvije stranice i nadvratnik.
    for (const side of [-1, 1]) {
      const post = MeshBuilder.CreateBox(
        "dovratnik",
        { width: 0.18, height: WORLD.WALL_HEIGHT * 0.78, depth: 0.18 },
        scene,
      );
      const offset = (cell / 2 - 0.09) * side;
      post.position.set(
        x + (along === "x" ? offset : 0),
        (WORLD.WALL_HEIGHT * 0.78) / 2,
        z + (along === "z" ? offset : 0),
      );
      frames.push(post);
    }

    const lintel = MeshBuilder.CreateBox(
      "nadvratnik",
      {
        width: along === "x" ? cell : 0.18,
        height: 0.18,
        depth: along === "z" ? cell : 0.18,
      },
      scene,
    );
    lintel.position.set(x, WORLD.WALL_HEIGHT * 0.78, z);
    frames.push(lintel);
  }

  const merged = Mesh.MergeMeshes(frames, true, true, undefined, false, false);
  if (!merged) return;
  merged.name = "dovratnici";
  merged.material = mats.doorFrame;
  merged.isPickable = false;
  merged.parent = root;
  merged.freezeWorldMatrix();
}

/** Tablica s oznakom dvorane iznad svakih vrata, okrenuta prema hodniku. */
function buildRoomSigns(scene: Scene, root: TransformNode): void {
  for (const room of ROOMS) {
    const facing = corridorFacing(room.door);
    const plane = createTextPlane(scene, room.label, 1.5, 0.75, 44);
    plane.position.set(
      colToX(room.door.col),
      WORLD.WALL_HEIGHT * 0.78 + 0.33,
      rowToZ(room.door.row),
    );
    // Mali odmak prema hodniku da tablica ne propada u zid.
    const n = facingNormal(facing);
    plane.position.addInPlace(n.scale(0.12));
    plane.rotation.y = SIGN_ROTATION[facing];
    plane.parent = root;
    plane.freezeWorldMatrix();
  }
}

/** Putokazi objeseni o strop na raskrizjima. */
function buildSignposts(scene: Scene, root: TransformNode): void {
  for (const sign of SIGNPOSTS) {
    const plane = createTextPlane(scene, sign.text, 3.2, 0.6, 26);
    plane.position.set(colToX(sign.col), WORLD.CEILING_HEIGHT - 0.55, rowToZ(sign.row));
    plane.rotation.y = SIGN_ROTATION[sign.dir];
    plane.parent = root;
    plane.freezeWorldMatrix();
  }
}

/** Ploha s tekstom nacrtanim u DynamicTexture. */
function createTextPlane(
  scene: Scene,
  text: string,
  widthM: number,
  heightM: number,
  fontPx: number,
): Mesh {
  // Tekstura je potencija dvojke radi mipmapa na svim uredajima.
  const texW = 512;
  const texH = 128;
  const texture = new DynamicTexture(
    `tablica_${text}`,
    { width: texW, height: texH },
    scene,
    true,
  );
  texture.hasAlpha = false;
  // DynamicTexture crta po platnu s ishodistem gore lijevo, a ploha mapira
  // v-os odozdo prema gore, pa bi tekst bez ovoga stajao naopako.
  texture.vScale = -1;
  texture.vOffset = 1;

  const ctx = texture.getContext() as CanvasRenderingContext2D;

  ctx.fillStyle = LOOK.SIGN_BG;
  ctx.fillRect(0, 0, texW, texH);
  ctx.strokeStyle = LOOK.SIGN_TEXT;
  ctx.lineWidth = 4;
  ctx.strokeRect(5, 5, texW - 10, texH - 10);
  ctx.fillStyle = LOOK.SIGN_TEXT;
  ctx.font = `bold ${fontPx}px "Segoe UI", Helvetica, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, texW / 2, texH / 2, texW - 28);
  texture.update(false);

  const material = new StandardMaterial(`matTablica_${text}`, scene);
  material.diffuseTexture = texture;
  material.emissiveTexture = texture;
  material.emissiveColor = new Color3(0.55, 0.55, 0.55);
  material.specularColor = Color3.Black();
  material.disableLighting = false;
  material.maxSimultaneousLights = LOOK.MAX_LIGHTS;

  const plane = MeshBuilder.CreatePlane(
    `plohaTablica_${text}`,
    { width: widthM, height: heightM },
    scene,
  );
  plane.material = material;
  plane.isPickable = false;
  return plane;
}

/** Os duz koje se proteze zid u kojem su vrata. */
function doorAxis(door: Cell): "x" | "z" {
  const roomIsHorizontal =
    tileAt(door.col - 1, door.row) === TILE.ROOM || tileAt(door.col + 1, door.row) === TILE.ROOM;
  // Ako je dvorana lijevo ili desno, vrata gledaju duz osi x, pa se zid pruza duz z.
  return roomIsHorizontal ? "z" : "x";
}

/** Smjer iz vrata prema hodniku. */
function corridorFacing(door: Cell): Facing {
  const candidates: Array<[Facing, number, number]> = [
    ["e", 1, 0],
    ["w", -1, 0],
    ["s", 0, 1],
    ["n", 0, -1],
  ];
  for (const [facing, dx, dy] of candidates) {
    const t = tileAt(door.col + dx, door.row + dy);
    if (t !== TILE.WALL && t !== TILE.ROOM) return facing;
  }
  return "s";
}

function facingNormal(facing: Facing): Vector3 {
  switch (facing) {
    case "n":
      return new Vector3(0, 0, -1);
    case "s":
      return new Vector3(0, 0, 1);
    case "e":
      return new Vector3(1, 0, 0);
    case "w":
      return new Vector3(-1, 0, 0);
  }
}

/** Broj redaka mreze; koristi se u testovima i alatima. */
export const LEVEL_SIZE = { cols: MAP_COLS, rows: MAP_ROWS, lines: FLOOR_MAP.length };
