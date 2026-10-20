import type { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { Control } from "@babylonjs/gui/2D/controls/control";
import { Ellipse } from "@babylonjs/gui/2D/controls/ellipse";

import { PLAYER, TOUCH } from "../config";
import type { Player } from "../player/Player";

/** Srediste i polumjer joysticka, u CSS pikselima canvasa. */
interface StickGeometry {
  x: number;
  y: number;
  radius: number;
}

/**
 * Kontrole za dodir: virtualni joystick u donjem lijevom kutu i povlacenje
 * prstom za pogled u desnoj polovici ekrana. Na uredajima bez dodira se ne
 * prikazuje.
 */
export class TouchControls {
  private readonly base: Ellipse;
  private readonly thumb: Ellipse;

  /** Pokazivac koji drzi joystick, i onaj koji okrece pogled. */
  private movePointerId: number | null = null;
  private lookPointerId: number | null = null;
  private lastLook = { x: 0, y: 0 };
  private active = false;

  private readonly onDown: (ev: PointerEvent) => void;
  private readonly onMove: (ev: PointerEvent) => void;
  private readonly onUp: (ev: PointerEvent) => void;

  constructor(
    private readonly ui: AdvancedDynamicTexture,
    private readonly canvas: HTMLCanvasElement,
    private readonly player: Player,
  ) {
    this.base = new Ellipse("joystickBaza");
    this.base.width = `${TOUCH.JOYSTICK_SIZE}px`;
    this.base.height = `${TOUCH.JOYSTICK_SIZE}px`;
    this.base.thickness = 3;
    this.base.color = "rgba(255, 255, 255, 0.45)";
    this.base.background = "rgba(255, 255, 255, 0.10)";
    this.base.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.base.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.base.left = `${TOUCH.MARGIN}px`;
    this.base.top = `-${TOUCH.MARGIN}px`;
    this.base.isPointerBlocker = false;
    this.base.isVisible = false;
    ui.addControl(this.base);

    this.thumb = new Ellipse("joystickPalac");
    this.thumb.width = `${TOUCH.THUMB_SIZE}px`;
    this.thumb.height = `${TOUCH.THUMB_SIZE}px`;
    this.thumb.thickness = 2;
    this.thumb.color = "rgba(255, 255, 255, 0.7)";
    this.thumb.background = "rgba(255, 255, 255, 0.28)";
    this.thumb.isPointerBlocker = false;
    this.base.addControl(this.thumb);

    this.onDown = (ev) => this.handleDown(ev);
    this.onMove = (ev) => this.handleMove(ev);
    this.onUp = (ev) => this.handleUp(ev);
  }

  /** Ima li uredaj dodirni ekran. */
  static isTouchDevice(): boolean {
    return (
      typeof window !== "undefined" &&
      ("ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0)
    );
  }

  /** Prikazuje joystick i hvata dodire; samo dok runda traje. */
  setEnabled(enabled: boolean): void {
    if (enabled === this.active) return;
    this.active = enabled;
    this.base.isVisible = enabled;

    if (enabled) {
      this.canvas.addEventListener("pointerdown", this.onDown);
      this.canvas.addEventListener("pointermove", this.onMove);
      window.addEventListener("pointerup", this.onUp);
      window.addEventListener("pointercancel", this.onUp);
    } else {
      this.canvas.removeEventListener("pointerdown", this.onDown);
      this.canvas.removeEventListener("pointermove", this.onMove);
      window.removeEventListener("pointerup", this.onUp);
      window.removeEventListener("pointercancel", this.onUp);
      this.release();
    }
  }

  dispose(): void {
    this.setEnabled(false);
    this.base.dispose();
  }

  /**
   * Polozaj i polumjer joysticka u CSS pikselima, izracunat iz stvarno
   * iscrtane kontrole. Babylon GUI skalira zadane velicine prema idealnim
   * dimenzijama, pa je ovo jedini nacin da se vidljivi krug i podrucje
   * dodira uvijek poklapaju.
   */
  private stickGeometry(): StickGeometry {
    const measure = this.base._currentMeasure;
    const texture = this.ui.getSize();
    const rect = this.canvas.getBoundingClientRect();
    const kx = rect.width / texture.width;
    const ky = rect.height / texture.height;
    return {
      x: (measure.left + measure.width / 2) * kx,
      y: (measure.top + measure.height / 2) * ky,
      radius: (measure.width / 2) * kx,
    };
  }

  private handleDown(ev: PointerEvent): void {
    if (ev.pointerType === "mouse") return;
    const rect = this.canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    // Lijeva polovica ekrana vozi, desna okrece pogled.
    if (x < rect.width * 0.5 && this.movePointerId === null) {
      this.movePointerId = ev.pointerId;
      this.updateStick(x, y);
    } else if (this.lookPointerId === null) {
      this.lookPointerId = ev.pointerId;
      this.lastLook = { x, y };
    }
  }

  private handleMove(ev: PointerEvent): void {
    if (ev.pointerType === "mouse") return;
    const rect = this.canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    if (ev.pointerId === this.movePointerId) {
      this.updateStick(x, y);
      return;
    }

    if (ev.pointerId === this.lookPointerId) {
      const dx = x - this.lastLook.x;
      const dy = y - this.lastLook.y;
      this.lastLook = { x, y };
      this.player.addLook(dx * PLAYER.TOUCH_LOOK_SENSITIVITY, dy * PLAYER.TOUCH_LOOK_SENSITIVITY);
    }
  }

  /** Pretvara polozaj prsta u pomak igraca i pomice palac joysticka. */
  private updateStick(x: number, y: number): void {
    const stick = this.stickGeometry();
    if (stick.radius <= 0) return;

    let dx = (x - stick.x) / stick.radius;
    // Ekran raste prema dolje, a naprijed je gore, pa y okrecemo.
    let dy = -(y - stick.y) / stick.radius;

    const length = Math.hypot(dx, dy);
    if (length > 1) {
      dx /= length;
      dy /= length;
    }

    if (Math.min(length, 1) < TOUCH.DEAD_ZONE) {
      this.player.setMoveInput(0, 0);
      this.centerThumb();
      return;
    }

    this.player.setMoveInput(dx, dy);
    // Palac se pomice u jedinicama GUI-ja, iste one u kojima je zadana baza.
    const guiRadius = TOUCH.JOYSTICK_SIZE / 2;
    this.thumb.left = `${dx * guiRadius * 0.7}px`;
    this.thumb.top = `${-dy * guiRadius * 0.7}px`;
  }

  private handleUp(ev: PointerEvent): void {
    if (ev.pointerId === this.movePointerId) {
      this.movePointerId = null;
      this.player.setMoveInput(0, 0);
      this.centerThumb();
    }
    if (ev.pointerId === this.lookPointerId) {
      this.lookPointerId = null;
    }
  }

  private centerThumb(): void {
    this.thumb.left = "0px";
    this.thumb.top = "0px";
  }

  private release(): void {
    this.movePointerId = null;
    this.lookPointerId = null;
    this.player.setMoveInput(0, 0);
    this.centerThumb();
  }
}
