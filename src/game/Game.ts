import type { Engine } from "@babylonjs/core/Engines/engine";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";

import "@babylonjs/core/Collisions/collisionCoordinator";

import { AUDIO, LOOK, PLAYER, ROUND } from "../config";
import { Sfx } from "../audio/Sfx";
import { Coffee } from "../pickups/Coffee";
import { Hud } from "../ui/Hud";
import { Player } from "../player/Player";
import { Screens, loadHighscore, saveHighscore } from "../ui/Screens";
import { Students } from "../npc/Students";
import { TouchControls } from "../ui/TouchControls";
import { buildLevelFromGrid, type BuiltLevel, type RoomTrigger } from "../level/LevelBuilder";

/** Faze u kojima se igra moze nalaziti. */
export type GameState = "pocetak" | "igra" | "pobjeda" | "poraz";

/**
 * Sredisnji objekt igre. Drzi scenu i stanje runde te povezuje module:
 * kat, igraca, studente, kave, HUD i ekrane.
 */
export class Game {
  private readonly scene: Scene;
  private readonly ui: AdvancedDynamicTexture;
  private readonly level: BuiltLevel;
  private readonly player: Player;
  private readonly students: Students;
  private readonly coffee: Coffee;
  private readonly hud: Hud;
  private readonly screens: Screens;
  private readonly touch: TouchControls;
  private readonly sfx = new Sfx();

  private state: GameState = "pocetak";
  private timeLeft: number = ROUND.DURATION_S;
  private target: RoomTrigger;
  private highscore = loadHighscore();
  /** Zadnja cijela sekunda na kojoj je odsviran otkucaj. */
  private lastTickSecond = -1;
  /** Preostali hlad po dvorani, da ista kriva dvorana ne kaznjava u nizu. */
  private readonly wrongRoomCooldowns = new Map<string, number>();

  constructor(
    private readonly engine: Engine,
    private readonly canvas: HTMLCanvasElement,
  ) {
    this.scene = new Scene(engine);
    this.scene.clearColor = Color4.FromHexString(`${LOOK.CLEAR_COLOR}ff`);
    this.scene.collisionsEnabled = true;
    this.scene.gravity = new Vector3(0, PLAYER.GRAVITY_Y, 0);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = LOOK.FOG_DENSITY;
    this.scene.fogColor = Color3.FromHexString(LOOK.CLEAR_COLOR);

    this.setupLights();

    this.level = buildLevelFromGrid(this.scene);
    this.player = new Player(
      this.scene,
      canvas,
      this.level.playerStart,
      this.level.playerStartYaw,
    );
    this.students = new Students(this.scene, this.level);
    this.coffee = new Coffee(this.scene, this.level);

    this.ui = AdvancedDynamicTexture.CreateFullscreenUI("sucelje", true, this.scene);
    /*
     * Velicine kontrola zadane su u idealnim pikselima i skaliraju se prema
     * stvarnoj velicini platna. useSmallestIdeal uzima manji od dva omjera,
     * pa na uskom ekranu mobitela sadrzaj ostaje unutar vidljivog podrucja.
     * renderAtIdealSize namjerno ostaje iskljucen jer bi platno sucelja
     * renderirao u fiksnoj velicini i na mobitelu zbio sve u kut.
     */
    this.ui.idealWidth = 420;
    this.ui.idealHeight = 760;
    this.ui.useSmallestIdeal = true;

    this.hud = new Hud(this.ui);
    this.screens = new Screens(
      this.ui,
      () => this.startRound(),
      () => this.startRound(),
    );
    this.touch = new TouchControls(this.ui, canvas, this.player);

    this.target = this.pickTarget();

    this.setupInput();
    this.showStartScreen();

    this.scene.onBeforeRenderObservable.add(() => this.update());

    if (import.meta.env.DEV) {
      // Inspector postoji samo u razvoju; u produkciji ova grana otpada.
      void import("../dev/inspector").then((m) => m.registerInspectorHotkey(this.scene));
    }
  }

  /** Trenutno stanje igre. */
  getState(): GameState {
    return this.state;
  }

  /** Crta jedan kadar; zove se iz render loopa. */
  render(): void {
    this.scene.render();
  }

  dispose(): void {
    this.touch.dispose();
    this.sfx.dispose();
    this.scene.dispose();
  }

  /** Engine je dostupan modulima koji trebaju deltaTime. */
  getEngine(): Engine {
    return this.engine;
  }

  /** Scena; koristi se u razvoju i za Inspector. */
  getScene(): Scene {
    return this.scene;
  }

  // --- postavljanje -------------------------------------------------------

  private setupLights(): void {
    const ambient = new HemisphericLight("ambijent", new Vector3(0, 1, 0), this.scene);
    ambient.intensity = LOOK.AMBIENT_INTENSITY;
    // Svjetlo je bijelo; boju daju materijali, inace se boja mnozi dvaput i sve potamni.
    ambient.diffuse = Color3.White();
    ambient.groundColor = Color3.FromHexString("#2a2f36");
    ambient.specular = Color3.Black();

    // Nekoliko tockastih svjetala za dubinu; bez sjena da FPS ostane visok.
    const spots: Array<[number, number]> = [
      [-26, -16],
      [26, -16],
      [-26, 16],
      [26, 16],
    ];
    for (const [x, z] of spots) {
      const light = new PointLight(`svjetlo_${x}_${z}`, new Vector3(x, 2.6, z), this.scene);
      light.intensity = 0.5;
      light.range = 24;
      light.diffuse = Color3.FromHexString(LOOK.NEON_COLOR);
      light.specular = Color3.Black();
    }

    const glow = new GlowLayer("sjaj", this.scene, { mainTextureFixedSize: 256, blurKernelSize: 24 });
    glow.intensity = LOOK.GLOW_INTENSITY;
  }

  private setupInput(): void {
    window.addEventListener("keydown", (ev) => {
      if (ev.code === "KeyR" && !ev.ctrlKey && !ev.metaKey) {
        ev.preventDefault();
        this.startRound();
      }
    });

    // Klik na canvas hvata mis i otkljucava zvuk.
    this.canvas.addEventListener("pointerdown", () => {
      this.sfx.unlock();
      if (this.state === "igra" && !TouchControls.isTouchDevice()) {
        this.player.requestPointerLock();
      }
    });

    // Kad igrac pusti mis tipkom Escape, runda se ne prekida, samo kontrole miruju.
    document.addEventListener("pointerlockchange", () => {
      if (this.state !== "igra") return;
      this.player.setControlsEnabled(true);
    });
  }

  // --- tijek runde --------------------------------------------------------

  private showStartScreen(): void {
    this.state = "pocetak";
    this.hud.setVisible(false);
    this.screens.showStart();
    this.player.setControlsEnabled(false);
    this.touch.setEnabled(false);
  }

  /** Pokrece novu rundu s nasumicnom ciljnom dvoranom. */
  private startRound(): void {
    this.sfx.unlock();

    this.state = "igra";
    this.timeLeft = ROUND.DURATION_S;
    this.lastTickSecond = -1;
    this.wrongRoomCooldowns.clear();
    this.target = this.pickTarget();

    this.player.reset(this.level.playerStart, this.level.playerStartYaw);
    this.player.setControlsEnabled(true);
    this.students.respawn();
    this.coffee.reset();

    this.hud.reset();
    this.hud.setVisible(true);
    this.hud.setTarget(this.target.label);
    this.hud.showMessage(`Trazi dvoranu ${this.target.label}`, 2.5);
    this.screens.hideAll();

    if (TouchControls.isTouchDevice()) {
      this.touch.setEnabled(true);
    } else {
      this.player.requestPointerLock();
    }
  }

  private endRound(won: boolean): void {
    this.state = won ? "pobjeda" : "poraz";
    this.player.setControlsEnabled(false);
    this.player.releasePointerLock();
    this.touch.setEnabled(false);
    this.hud.setVisible(false);

    if (won) {
      const score = Math.max(0, Math.ceil(this.timeLeft));
      this.highscore = saveHighscore(score);
      this.sfx.win();
      this.screens.showWin(score, this.highscore, this.target.label);
    } else {
      this.sfx.lose();
      this.screens.showLose(this.highscore, this.target.label);
    }
  }

  /** Nasumicno bira ciljnu dvoranu za rundu. */
  private pickTarget(): RoomTrigger {
    const triggers = this.level.roomTriggers;
    return triggers[Math.floor(Math.random() * triggers.length)];
  }

  // --- petlja -------------------------------------------------------------

  private update(): void {
    // Delta u sekundama, ogranicena da skok kadra ne preskoci kolizije.
    const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.1);

    this.hud.update(dt);

    if (this.state !== "igra") return;

    this.player.update(dt);
    const playerPos = this.player.groundPosition;

    this.updateTimer(dt);
    if (this.state !== "igra") return;

    if (this.students.update(dt, playerPos)) {
      this.player.applySlow();
      this.sfx.bump();
      this.hud.showMessage("Pazi malo!", 1);
    }

    if (this.coffee.update(dt, playerPos) > 0) {
      this.player.applyCoffee();
      this.sfx.coffee();
      this.hud.showMessage("Kava! Brzi si.", 1.5);
    }

    this.checkRoomTriggers(dt, playerPos);
    this.hud.setEffects(this.player.getActiveEffects());
  }

  private updateTimer(dt: number): void {
    this.timeLeft -= dt;
    this.hud.setTime(this.timeLeft, dt);

    // Otkucaji u zadnjim sekundama, tocno jednom po sekundi.
    const second = Math.ceil(this.timeLeft);
    if (this.timeLeft <= AUDIO.TICK_FROM_S && second !== this.lastTickSecond && second > 0) {
      this.lastTickSecond = second;
      this.sfx.tick(second <= 5);
    }

    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.endRound(false);
    }
  }

  private checkRoomTriggers(dt: number, playerPos: Vector3): void {
    for (const [label, cooldown] of this.wrongRoomCooldowns) {
      const left = cooldown - dt;
      if (left <= 0) this.wrongRoomCooldowns.delete(label);
      else this.wrongRoomCooldowns.set(label, left);
    }

    for (const room of this.level.roomTriggers) {
      const dx = playerPos.x - room.center.x;
      const dz = playerPos.z - room.center.z;
      if (dx * dx + dz * dz > room.radius * room.radius) continue;

      if (room.label === this.target.label) {
        this.endRound(true);
        return;
      }

      if (this.wrongRoomCooldowns.has(room.label)) continue;
      this.wrongRoomCooldowns.set(room.label, ROUND.WRONG_ROOM_COOLDOWN_S);
      this.timeLeft = Math.max(0, this.timeLeft - ROUND.WRONG_ROOM_PENALTY_S);
      this.sfx.wrongRoom();
      this.hud.showMessage(`Kriva dvorana!  -${ROUND.WRONG_ROOM_PENALTY_S} s`, 1.5);
    }
  }
}
