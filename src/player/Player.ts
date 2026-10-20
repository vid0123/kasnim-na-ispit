import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";

import "@babylonjs/core/Cameras/Inputs/freeCameraKeyboardMoveInput";
import "@babylonjs/core/Cameras/Inputs/freeCameraMouseInput";
import "@babylonjs/core/Cameras/Inputs/freeCameraTouchInput";

import { EFFECTS, PLAYER, SHAKE } from "../config";

/** Efekt koji privremeno mijenja brzinu igraca. */
export type EffectKind = "usporen" | "kava";

interface ActiveEffect {
  kind: EffectKind;
  multiplier: number;
  remaining: number;
}

/**
 * Babylonova FreeCamera pomice se za speed * sqrt(dt / (fps * 100)) po kadru,
 * sto u jednoj sekundi daje speed * sqrt(10) metara neovisno o broju sličica.
 * Zato brzinu u metrima po sekundi dijelimo ovim faktorom.
 */
const SPEED_TO_CAMERA = Math.sqrt(10);

/** Najveci nagib kamere gore-dolje, da se pogled ne prevrne. */
const MAX_PITCH = Math.PI / 2 - 0.05;

/** Igrac: kamera iz prvog lica, kontrole, brzina i efekti. */
export class Player {
  readonly camera: UniversalCamera;

  private readonly effects: ActiveEffect[] = [];
  private shakeRemaining = 0;
  private controlsAttached = false;
  /** Pomak iz virtualnog joysticka: x je desno, y je naprijed, oba u [-1, 1]. */
  private readonly moveInput = { x: 0, y: 0 };

  constructor(
    private readonly scene: Scene,
    private readonly canvas: HTMLCanvasElement,
    startPosition: Vector3,
    startYaw = 0,
  ) {
    this.camera = new UniversalCamera("igrac", Vector3.Zero(), scene);
    this.camera.minZ = PLAYER.NEAR_CLIP;
    this.camera.maxZ = PLAYER.FAR_CLIP;
    this.camera.fov = PLAYER.FOV;
    this.camera.inertia = 0.72;
    this.camera.angularSensibility = PLAYER.MOUSE_ANGULAR_SENSIBILITY;

    // Kolizije i gravitacija; bez skakanja.
    this.camera.checkCollisions = true;
    this.camera.applyGravity = true;
    /*
     * Elipsoid je tijelo igraca. Babylon srediste elipsoida sam racuna kao
     * position.y - ellipsoid.y, dakle kamera je oko na vrhu tijela. Zato
     * ellipsoidOffset ostaje nula; svaki pomak po y ovdje pomice tijelo kroz
     * pod i igrac se penje uz zidove ili tone u njih.
     */
    this.camera.ellipsoid = new Vector3(
      PLAYER.ELLIPSOID_RADIUS,
      PLAYER.EYE_HEIGHT / 2,
      PLAYER.ELLIPSOID_RADIUS,
    );
    this.camera.ellipsoidOffset = Vector3.Zero();

    // WASD uz strelice. Babylon strelice dodaje sam, pa dodajemo samo slova.
    this.camera.keysUp = [87, 38]; // W, gore
    this.camera.keysDown = [83, 40]; // S, dolje
    this.camera.keysLeft = [65, 37]; // A, lijevo
    this.camera.keysRight = [68, 39]; // D, desno

    this.setSpeed(PLAYER.BASE_SPEED);
    this.reset(startPosition, startYaw);
  }

  /** Vraca igraca na pocetak i brise sve efekte. */
  reset(startPosition: Vector3, startYaw = 0): void {
    this.camera.position.set(
      startPosition.x,
      startPosition.y + PLAYER.EYE_HEIGHT,
      startPosition.z,
    );
    this.camera.rotation.set(0, startYaw, 0);
    this.camera.cameraDirection.setAll(0);
    this.camera.cameraRotation.setAll(0);
    this.effects.length = 0;
    this.shakeRemaining = 0;
    this.moveInput.x = 0;
    this.moveInput.y = 0;
    this.setSpeed(PLAYER.BASE_SPEED);
  }

  /** Pozicija igraca na visini poda. */
  get groundPosition(): Vector3 {
    return new Vector3(
      this.camera.position.x,
      this.camera.position.y - PLAYER.EYE_HEIGHT,
      this.camera.position.z,
    );
  }

  /** Ukljucuje ili iskljucuje kontrole; ekrani izmedu rundi ih gase. */
  setControlsEnabled(enabled: boolean): void {
    if (enabled === this.controlsAttached) return;
    if (enabled) this.camera.attachControl(this.canvas, true);
    else this.camera.detachControl();
    this.controlsAttached = enabled;
  }

  /** Trazi pointer lock; mora se zvati iz obrade korisnickog klika. */
  requestPointerLock(): void {
    if (document.pointerLockElement === this.canvas) return;
    try {
      // Noviji preglednici vracaju Promise, stariji nista. Odbijanje nije
      // greska: bez zakljucanog misa igra se i dalje moze igrati povlacenjem.
      const request: unknown = this.canvas.requestPointerLock();
      if (request instanceof Promise) request.catch(() => undefined);
    } catch {
      // Safari zna baciti iznimku umjesto odbijanja.
    }
  }

  releasePointerLock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /** Pomak s virtualnog joysticka; x desno, y naprijed, oba u [-1, 1]. */
  setMoveInput(x: number, y: number): void {
    this.moveInput.x = x;
    this.moveInput.y = y;
  }

  /** Rotacija pogleda povlacenjem prsta, u radijanima. */
  addLook(deltaYaw: number, deltaPitch: number): void {
    this.camera.rotation.y += deltaYaw;
    this.camera.rotation.x = clamp(this.camera.rotation.x + deltaPitch, -MAX_PITCH, MAX_PITCH);
  }

  /** Usporava igraca nakon sudara sa studentom i trese kameru. */
  applySlow(): void {
    this.addEffect("usporen", EFFECTS.SLOW_MULTIPLIER, EFFECTS.SLOW_DURATION_S);
    this.shakeRemaining = SHAKE.DURATION_S;
  }

  /** Ubrzava igraca nakon popijene kave. */
  applyCoffee(): void {
    this.addEffect("kava", EFFECTS.COFFEE_MULTIPLIER, EFFECTS.COFFEE_DURATION_S);
  }

  /** Efekti koji su trenutno aktivni; HUD ih prikazuje kao ikone. */
  getActiveEffects(): EffectKind[] {
    return this.effects.map((e) => e.kind);
  }

  /** Jedan korak simulacije igraca. */
  update(dt: number): void {
    this.updateEffects(dt);
    this.applyJoystickMovement();
    this.updateShake(dt);
  }

  dispose(): void {
    this.camera.dispose();
  }

  private addEffect(kind: EffectKind, multiplier: number, duration: number): void {
    const existing = this.effects.find((e) => e.kind === kind);
    if (existing) existing.remaining = duration;
    else this.effects.push({ kind, multiplier, remaining: duration });
    this.refreshSpeed();
  }

  private updateEffects(dt: number): void {
    if (this.effects.length === 0) return;
    let changed = false;
    for (let i = this.effects.length - 1; i >= 0; i--) {
      this.effects[i].remaining -= dt;
      if (this.effects[i].remaining <= 0) {
        this.effects.splice(i, 1);
        changed = true;
      }
    }
    if (changed) this.refreshSpeed();
  }

  private refreshSpeed(): void {
    let multiplier = 1;
    for (const effect of this.effects) multiplier *= effect.multiplier;
    this.setSpeed(PLAYER.BASE_SPEED * multiplier);
  }

  private setSpeed(metersPerSecond: number): void {
    this.camera.speed = metersPerSecond / SPEED_TO_CAMERA;
  }

  /**
   * Joystick pomak dodajemo u cameraDirection, isto mjesto gdje pisu i tipke,
   * pa kolizije i gravitacija rade bez dodatnog koda.
   */
  private applyJoystickMovement(): void {
    const { x, y } = this.moveInput;
    if (x === 0 && y === 0) return;

    // Ista pretvorba brzine kao kod tipkovnice.
    const step = this.camera.speed * Math.sqrt(
      this.scene.getEngine().getDeltaTime() / (Math.max(this.scene.getEngine().getFps(), 1) * 100),
    );

    const yaw = this.camera.rotation.y;
    const forward = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

    this.camera.cameraDirection.addInPlace(forward.scaleInPlace(y * step));
    this.camera.cameraDirection.addInPlace(right.scaleInPlace(x * step));
  }

  /** Kratko trese pogled; zakret je siguran jer ne dira kolizije. */
  private updateShake(dt: number): void {
    if (this.shakeRemaining <= 0) {
      if (this.camera.rotation.z !== 0) this.camera.rotation.z = 0;
      return;
    }
    this.shakeRemaining -= dt;
    const fade = Math.max(this.shakeRemaining, 0) / SHAKE.DURATION_S;
    const t = (SHAKE.DURATION_S - this.shakeRemaining) * SHAKE.FREQUENCY;
    this.camera.rotation.z = Math.sin(t) * SHAKE.AMPLITUDE * fade;
    this.camera.rotation.x = clamp(
      this.camera.rotation.x + Math.sin(t * 0.7) * SHAKE.AMPLITUDE * 0.35 * fade * dt * 10,
      -MAX_PITCH,
      MAX_PITCH,
    );
  }
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
