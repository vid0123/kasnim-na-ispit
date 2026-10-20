/**
 * Sve podesive konstante igre na jednom mjestu.
 * Mijenjaj vrijednosti ovdje, a ne razasute po modulima.
 */

/** Runda i bodovanje. */
export const ROUND = {
  /** Trajanje runde u sekundama. */
  DURATION_S: 90,
  /** Ispod ovoliko sekundi odbrojavanje postaje crveno i pulsira. */
  WARNING_S: 15,
  /** Kazna u sekundama za ulazak u krivu dvoranu. */
  WRONG_ROOM_PENALTY_S: 5,
  /** Koliko dugo ista kriva dvorana ne moze ponovno kazniti igraca. */
  WRONG_ROOM_COOLDOWN_S: 3,
  /** Kljuc za najbolji rezultat u localStorage. */
  HIGHSCORE_KEY: "kasnim-na-ispit.najboljiRezultat",
} as const;

/** Geometrija kata. Jedna celija mreze je kvadrat od CELL_SIZE metara. */
export const WORLD = {
  CELL_SIZE: 2,
  WALL_HEIGHT: 3,
  /** Debljina zida; manja od celije da hodnik ostane prohodan. */
  WALL_THICKNESS: 2,
  /** Visina na kojoj stoje stropne ploce. */
  CEILING_HEIGHT: 3,
} as const;

/** Igrac i kamera. */
export const PLAYER = {
  /** Visina ociju u metrima. */
  EYE_HEIGHT: 1.7,
  /** Osnovna brzina hoda u metrima po sekundi. */
  BASE_SPEED: 4.2,
  /** Radijus elipsoida kolizije. */
  ELLIPSOID_RADIUS: 0.5,
  /** Osjetljivost misa; veci broj znaci sporije okretanje. */
  MOUSE_ANGULAR_SENSIBILITY: 1400,
  /** Osjetljivost povlacenja prstom na touch uredajima. */
  TOUCH_LOOK_SENSITIVITY: 0.0045,
  /** Blizi clip plane da se kroz zid ne vidi kad je igrac tik uz njega. */
  NEAR_CLIP: 0.1,
  FAR_CLIP: 120,
  FOV: 1.1,
  /** Gravitacija po kadru; drzi igraca na podu. */
  GRAVITY_Y: -0.35,
} as const;

/** Efekti koji mijenjaju brzinu igraca. */
export const EFFECTS = {
  /** Mnozitelj brzine nakon sudara sa studentom. */
  SLOW_MULTIPLIER: 0.5,
  /** Trajanje usporenja u sekundama. */
  SLOW_DURATION_S: 2,
  /** Mnozitelj brzine nakon kave. */
  COFFEE_MULTIPLIER: 1.5,
  /** Trajanje ubrzanja u sekundama. */
  COFFEE_DURATION_S: 5,
} as const;

/** Studenti u hodnicima. */
export const STUDENTS = {
  /** Koliko ih se stvori; broj se nasumicno bira iz ovog raspona. */
  MIN_COUNT: 10,
  MAX_COUNT: 15,
  /** Dio studenata koji samo stoji u grupama umjesto da hoda. */
  IDLE_RATIO: 0.3,
  MIN_SPEED: 1.1,
  MAX_SPEED: 2.2,
  /** Udaljenost na kojoj sudar s igracem pokrece usporenje. */
  HIT_DISTANCE: 0.8,
  /** Koliko dugo isti student ne moze ponovno usporiti igraca. */
  HIT_COOLDOWN_S: 1.2,
  HEIGHT: 1.75,
  RADIUS: 0.32,
  /** Najduza ruta koju student patrolira, u celijama. */
  MAX_PATROL_CELLS: 7,
} as const;

/** Kave razasute po hodnicima. */
export const COFFEE = {
  /** Udaljenost na kojoj se kava pokupi. */
  PICKUP_DISTANCE: 1.0,
  /** Visina sredista salice nad podom. */
  HOVER_HEIGHT: 1.1,
  /** Amplituda lebdenja u metrima. */
  BOB_AMPLITUDE: 0.12,
  /** Brzina lebdenja u radijanima po sekundi. */
  BOB_SPEED: 2.4,
  /** Brzina vrtnje u radijanima po sekundi. */
  SPIN_SPEED: 1.8,
} as const;

/** Trzanje kamere pri sudaru. */
export const SHAKE = {
  DURATION_S: 0.35,
  /** Najveci zakret kamere u radijanima. */
  AMPLITUDE: 0.045,
  /** Frekvencija trzanja u hercima. */
  FREQUENCY: 22,
} as const;

/** Boje i svjetla. */
export const LOOK = {
  CLEAR_COLOR: "#0b0e13",
  WALL_COLOR: "#d8d4c8",
  FLOOR_COLOR: "#3b3f46",
  CEILING_COLOR: "#b4bac2",
  DOOR_FRAME_COLOR: "#6b4f3a",
  SIGN_BG: "#123a5c",
  SIGN_TEXT: "#f2f7ff",
  NEON_COLOR: "#dff3ff",
  AMBIENT_INTENSITY: 0.95,
  /**
   * Najveci broj svjetala koja StandardMaterial obraduje u jednom prolazu.
   * Mora biti barem jednak ukupnom broju svjetala u sceni, inace Babylon
   * crta mesh vise puta i broj draw callova skoci.
   */
  MAX_LIGHTS: 5,
  GLOW_INTENSITY: 0.45,
  FOG_DENSITY: 0.008,
} as const;

/** Zvuk preko Web Audio API-ja. */
export const AUDIO = {
  MASTER_VOLUME: 0.35,
  /** Ispod ovoliko sekundi pocinju otkucaji. */
  TICK_FROM_S: 10,
} as const;

/** Mobilne kontrole. */
export const TOUCH = {
  /** Promjer baze joysticka u pikselima. */
  JOYSTICK_SIZE: 150,
  /** Promjer palca joysticka u pikselima. */
  THUMB_SIZE: 64,
  /** Odmak joysticka od ruba ekrana u pikselima. */
  MARGIN: 28,
  /** Mrtva zona joysticka kao dio radijusa. */
  DEAD_ZONE: 0.12,
} as const;
