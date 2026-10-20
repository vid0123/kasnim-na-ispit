/**
 * Opis kata kao 2D mreza znakova.
 *
 * Jedna celija je WORLD.CELL_SIZE metara. Mreza se cita kao FLOOR_MAP[row][col],
 * gdje col raste prema istoku (+x) a row prema jugu (+z).
 *
 * Znakovi:
 *   '#'  zid
 *   '.'  hodnik
 *   'o'  pod dvorane
 *   '+'  vrata dvorane (prolazna celija u zidu dvorane)
 *   'S'  pocetna pozicija igraca
 *   'C'  kava
 *   'N'  pocetna tocka studenta
 *
 * Mreza i popisi ispod su jedini izvor istine o katu. Sve sto gradi geometriju
 * zivi u LevelBuilder.ts, pa se ovaj modul moze mijenjati bez diranja ostatka igre.
 */

export const TILE = {
  WALL: "#",
  CORRIDOR: ".",
  ROOM: "o",
  DOOR: "+",
  START: "S",
  COFFEE: "C",
  STUDENT: "N",
} as const;

export type Tile = (typeof TILE)[keyof typeof TILE];

/** Celije po kojima se moze hodati. */
const WALKABLE = new Set<string>([
  TILE.CORRIDOR,
  TILE.ROOM,
  TILE.DOOR,
  TILE.START,
  TILE.COFFEE,
  TILE.STUDENT,
]);

/** Tlocrt kata: 40 celija siroko, 30 visoko (80 m x 60 m). */
export const FLOOR_MAP: readonly string[] = [
  "########################################",
  "##########..################..##########",
  "##########..################..##########",
  "##########..################..##########",
  "#####.....N.C.................N....#####",
  "#####...............N.......C......#####",
  "#ooo#.N############..############N.#ooo#",
  "#ooo+..#oooooooo###..###oooooooo#..+ooo#",
  "#ooo#..#oooooooo###..###oooooooo#..#ooo#",
  "#####.C#oooooooo###..###oooooooo#C.#####",
  "#ooo#..#oooooooo###C.###oooooooo#..#ooo#",
  "#ooo+..#oooooooo###..###oooooooo#..+ooo#",
  "#ooo#.N#oooooooo###..###oooooooo#N.#ooo#",
  "#####..####+################+####..#####",
  "#.......N.............N..............C.#",
  "#..C...........N..............N........#",
  "##..#..#####+######..######+#####..#..##",
  "##..#..#oooooooo###..###oooooooo#..#..##",
  "##..#..#oooooooo###..###oooooooo#..#..##",
  "##..#..#oooooooo###..###oooooooo#..#..##",
  "##..#.C#oooooooo###..###oooooooo#N.#..##",
  "##..#..#oooooooo###..###oooooooo#..#..##",
  "##..#..#oooooooo###..###oooooooo#..#..##",
  "#####..############..############..#####",
  "#####....................N.........#####",
  "#####.....N...................C....#####",
  "###########..####......####..###########",
  "###########..####..S...####..###########",
  "###########..####......####..###########",
  "########################################",
];

/** Celija u mrezi. */
export interface Cell {
  col: number;
  row: number;
}

/** Jedna dvorana: oznaka i celija njezinih vrata. */
export interface RoomDef {
  /** Oznaka koja se pise na tablicu nad vratima, npr. "A1". */
  label: string;
  /** Celija s znakom '+' u zidu dvorane. */
  door: Cell;
}

/**
 * Osam dvorana. Vrata moraju lezati na celiji '+' u FLOOR_MAP, imati tocno
 * jednu susjednu celiju dvorane i tocno jednu susjednu celiju hodnika.
 */
export const ROOMS: readonly RoomDef[] = [
  { label: "A1", door: { col: 4, row: 7 } },
  { label: "A2", door: { col: 4, row: 11 } },
  { label: "A3", door: { col: 11, row: 13 } },
  { label: "A4", door: { col: 12, row: 16 } },
  { label: "B1", door: { col: 35, row: 7 } },
  { label: "B2", door: { col: 35, row: 11 } },
  { label: "B3", door: { col: 28, row: 13 } },
  { label: "B4", door: { col: 27, row: 16 } },
];

/** Strana svijeta: n je prema manjem retku, s prema vecem, w prema manjem stupcu. */
export type Facing = "n" | "s" | "e" | "w";

/**
 * Putokaz objesen o strop.
 *
 * Vazno: `dir` je strana s koje se putokaz cita, to jest smjer u koji gleda
 * njegovo lice. Igrac koji hoda prema sjeveru nalazi se juzno od putokaza, pa
 * za njega treba `dir: "s"`. Ploca je jednostrana, pa za oba smjera hodnika
 * dodaj dva unosa.
 */
export interface SignpostDef {
  col: number;
  row: number;
  dir: Facing;
  text: string;
}

/** Smjer u koji igrac gleda na pocetku runde; "n" je prema unutrasnjosti zgrade. */
export const START_FACING: Facing = "n";

/** Putokazi na raskrizjima. */
export const SIGNPOSTS: readonly SignpostDef[] = [
  // Ulazni hodnik: igrac hoda prema sjeveru, pa ploce gledaju na jug.
  { col: 19, row: 24, dir: "s", text: "\u2191 Dvorane      Izlaz \u2193" },
  { col: 19, row: 17, dir: "s", text: "\u2190 A1\u2013A4      B1\u2013B4 \u2192" },

  // Glavni hodnik: ploce gledaju prema onome tko dolazi s te strane.
  { col: 14, row: 14, dir: "w", text: "Krilo B ravno" },
  { col: 25, row: 15, dir: "e", text: "Krilo A ravno" },

  // Krila prema sjeveru.
  { col: 6, row: 12, dir: "s", text: "\u2191 A1 \u00b7 A2" },
  { col: 34, row: 12, dir: "s", text: "\u2191 B1 \u00b7 B2" },

  // Krila natrag prema glavnom hodniku.
  { col: 6, row: 7, dir: "n", text: "\u2193 Glavni hodnik" },
  { col: 34, row: 7, dir: "n", text: "\u2193 Glavni hodnik" },

  // Sjeverni poprecni hodnik.
  { col: 13, row: 5, dir: "w", text: "A3 i A4 desno" },
  { col: 27, row: 5, dir: "e", text: "B3 i B4 lijevo" },

  // Juzni poprecni hodnik.
  { col: 9, row: 24, dir: "e", text: "Slijepi hodnici ravno" },

  // Saljiva ploca duboko u slijepom hodniku; cita se tek kad je kasno.
  { col: 19, row: 8, dir: "n", text: "Slijepi hodnik" },
];

/** Sirina mreze u celijama. */
export const MAP_COLS = FLOOR_MAP[0].length;

/** Visina mreze u celijama. */
export const MAP_ROWS = FLOOR_MAP.length;

/** Znak na celiji; izvan mreze vraca zid. */
export function tileAt(col: number, row: number): string {
  if (row < 0 || row >= MAP_ROWS) return TILE.WALL;
  const line = FLOOR_MAP[row];
  if (col < 0 || col >= line.length) return TILE.WALL;
  return line[col];
}

/** Moze li igrac stati na celiju. */
export function isWalkable(col: number, row: number): boolean {
  return WALKABLE.has(tileAt(col, row));
}

/** Sve celije sa zadanim znakom. */
export function findTiles(ch: string): Cell[] {
  const out: Cell[] = [];
  for (let row = 0; row < MAP_ROWS; row++) {
    const line = FLOOR_MAP[row];
    for (let col = 0; col < line.length; col++) {
      if (line[col] === ch) out.push({ col, row });
    }
  }
  return out;
}

/** Prva celija sa zadanim znakom, ili null. */
export function findTile(ch: string): Cell | null {
  return findTiles(ch)[0] ?? null;
}
