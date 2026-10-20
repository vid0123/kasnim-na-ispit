import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { Control } from "@babylonjs/gui/2D/controls/control";
import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { StackPanel } from "@babylonjs/gui/2D/controls/stackPanel";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";

import { ROUND } from "../config";
import type { EffectKind } from "../player/Player";

/** Odbrojavanje, ciljna dvorana, ikone efekata i kratke poruke. */
export class Hud {
  private readonly root: Rectangle;
  private readonly timerText: TextBlock;
  private readonly targetText: TextBlock;
  private readonly effectsPanel: StackPanel;
  private readonly messageText: TextBlock;

  private readonly effectChips = new Map<EffectKind, Rectangle>();
  private messageTimer = 0;
  private pulse = 0;

  constructor(private readonly ui: AdvancedDynamicTexture) {
    this.root = new Rectangle("hud");
    this.root.thickness = 0;
    this.root.background = "";
    this.root.isPointerBlocker = false;
    this.root.width = 1;
    this.root.height = 1;
    ui.addControl(this.root);

    this.timerText = new TextBlock("vrijeme", "90");
    this.timerText.color = "#ffffff";
    this.timerText.fontSize = 46;
    this.timerText.fontWeight = "bold";
    this.timerText.outlineColor = "#000000";
    this.timerText.outlineWidth = 5;
    this.timerText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.timerText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.timerText.top = "18px";
    this.timerText.height = "60px";
    this.timerText.isPointerBlocker = false;
    this.root.addControl(this.timerText);

    this.targetText = new TextBlock("cilj", "");
    this.targetText.color = "#ffe9a8";
    this.targetText.fontSize = 24;
    this.targetText.fontWeight = "bold";
    this.targetText.outlineColor = "#000000";
    this.targetText.outlineWidth = 4;
    this.targetText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.targetText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.targetText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.targetText.left = "20px";
    // Ispod odbrojavanja, inace se na uskom ekranu mobitela tekstovi preklapaju.
    this.targetText.top = "80px";
    this.targetText.width = "320px";
    this.targetText.height = "34px";
    this.targetText.isPointerBlocker = false;
    this.root.addControl(this.targetText);

    this.effectsPanel = new StackPanel("efekti");
    this.effectsPanel.isVertical = false;
    this.effectsPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.effectsPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.effectsPanel.left = "20px";
    this.effectsPanel.top = "118px";
    this.effectsPanel.height = "40px";
    this.effectsPanel.width = "360px";
    this.effectsPanel.isPointerBlocker = false;
    this.root.addControl(this.effectsPanel);

    this.messageText = new TextBlock("poruka", "");
    this.messageText.color = "#ffffff";
    this.messageText.fontSize = 34;
    this.messageText.fontWeight = "bold";
    this.messageText.outlineColor = "#000000";
    this.messageText.outlineWidth = 6;
    this.messageText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.messageText.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.messageText.top = "-40px";
    this.messageText.height = "60px";
    this.messageText.alpha = 0;
    this.messageText.isPointerBlocker = false;
    this.root.addControl(this.messageText);
  }

  setVisible(visible: boolean): void {
    this.root.isVisible = visible;
  }

  /** Ciljna dvorana gore lijevo. */
  setTarget(label: string): void {
    this.targetText.text = `Ispit: dvorana ${label}`;
  }

  /** Preostalo vrijeme; ispod granice tekst je crven i pulsira. */
  setTime(seconds: number, dt: number): void {
    const whole = Math.max(0, Math.ceil(seconds));
    this.timerText.text = String(whole);

    if (seconds <= ROUND.WARNING_S) {
      this.pulse += dt * 7;
      const scale = 1 + Math.sin(this.pulse) * 0.1;
      this.timerText.color = "#ff5a4f";
      this.timerText.fontSize = Math.round(46 * scale);
    } else {
      this.pulse = 0;
      this.timerText.color = "#ffffff";
      this.timerText.fontSize = 46;
    }
  }

  /** Ikone aktivnih efekata. */
  setEffects(active: EffectKind[]): void {
    for (const [kind, chip] of this.effectChips) {
      if (!active.includes(kind)) {
        this.effectsPanel.removeControl(chip);
        chip.dispose();
        this.effectChips.delete(kind);
      }
    }
    for (const kind of active) {
      if (this.effectChips.has(kind)) continue;
      const chip = createChip(kind);
      this.effectChips.set(kind, chip);
      this.effectsPanel.addControl(chip);
    }
  }

  /** Kratka poruka na sredini ekrana koja sama nestane. */
  showMessage(text: string, seconds = 1.5): void {
    this.messageText.text = text;
    this.messageText.alpha = 1;
    this.messageTimer = seconds;
  }

  update(dt: number): void {
    if (this.messageTimer <= 0) return;
    this.messageTimer -= dt;
    // Zadnjih pola sekunde poruka blijedi.
    this.messageText.alpha = Math.min(1, Math.max(0, this.messageTimer / 0.5));
  }

  /** Brise poruke i ikone; zove se na pocetku nove runde. */
  reset(): void {
    this.messageTimer = 0;
    this.messageText.alpha = 0;
    this.setEffects([]);
  }

  dispose(): void {
    this.root.dispose();
  }

  /** Tekstura na kojoj HUD crta; dijele je i ekrani. */
  get texture(): AdvancedDynamicTexture {
    return this.ui;
  }
}

function createChip(kind: EffectKind): Rectangle {
  const chip = new Rectangle(`efekt_${kind}`);
  chip.width = "165px";
  chip.height = "34px";
  chip.cornerRadius = 17;
  chip.thickness = 2;
  chip.paddingRight = "8px";
  chip.isPointerBlocker = false;

  const label = new TextBlock(`efektTekst_${kind}`);
  label.fontSize = 17;
  label.fontWeight = "bold";
  label.isPointerBlocker = false;

  if (kind === "kava") {
    chip.background = "#5a3a1b";
    chip.color = "#f0c080";
    label.text = "KAVA +50%";
    label.color = "#ffd9a0";
  } else {
    chip.background = "#3a2330";
    chip.color = "#ff8080";
    label.text = "USPOREN -50%";
    label.color = "#ffb0b0";
  }

  chip.addControl(label);
  return chip;
}
