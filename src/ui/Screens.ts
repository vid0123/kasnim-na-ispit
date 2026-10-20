import type { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { Button } from "@babylonjs/gui/2D/controls/button";
import { Control } from "@babylonjs/gui/2D/controls/control";
import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { StackPanel } from "@babylonjs/gui/2D/controls/stackPanel";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";

import { ROUND } from "../config";

/** Ekrani izmedu rundi: pocetak, pobjeda i poraz. */
export class Screens {
  private readonly startPanel: Rectangle;
  private readonly endPanel: Rectangle;
  private readonly endTitle: TextBlock;
  private readonly endBody: TextBlock;
  private readonly endButton: Button;

  constructor(
    ui: AdvancedDynamicTexture,
    private readonly onStart: () => void,
    private readonly onRestart: () => void,
  ) {
    this.startPanel = createOverlay("pocetniEkran");
    ui.addControl(this.startPanel);

    const startStack = new StackPanel("pocetniSadrzaj");
    startStack.width = "90%";
    startStack.spacing = 10;
    this.startPanel.addControl(startStack);

    startStack.addControl(
      makeText("Kasnim na ispit", 54, "#ffd166", { bold: true }),
    );
    startStack.addControl(
      makeText(
        "Ispit pocinje za 90 sekundi, a ti jos ne znas gdje je dvorana.\n" +
          "Pronadi je prije nego sto istekne vrijeme.",
        22,
        "#e8edf4",
      ),
    );
    startStack.addControl(
      makeText(
        "WASD ili strelice za kretanje\n" +
          "mis za gledanje uokolo\n" +
          "na mobitelu: joystick lijevo, povlacenje prstom za pogled\n" +
          "R za novu rundu",
        20,
        "#9fb3c8",
      ),
    );
    startStack.addControl(
      makeText(
        "Studenti u hodniku te usporavaju, kava te ubrzava.",
        20,
        "#9fb3c8",
      ),
    );

    const startButton = makeButton("gumbPocetak", "Klikni za pocetak", "#2d8f5a");
    startButton.onPointerUpObservable.add(() => this.onStart());
    startStack.addControl(startButton);

    this.endPanel = createOverlay("zavrsniEkran");
    this.endPanel.isVisible = false;
    ui.addControl(this.endPanel);

    const endStack = new StackPanel("zavrsniSadrzaj");
    endStack.width = "90%";
    endStack.spacing = 12;
    this.endPanel.addControl(endStack);

    this.endTitle = makeText("", 52, "#ffd166", { bold: true });
    endStack.addControl(this.endTitle);

    this.endBody = makeText("", 26, "#e8edf4");
    endStack.addControl(this.endBody);

    this.endButton = makeButton("gumbPonovno", "Igraj ponovno (R)", "#2d6f8f");
    this.endButton.onPointerUpObservable.add(() => this.onRestart());
    endStack.addControl(this.endButton);
  }

  showStart(): void {
    this.startPanel.isVisible = true;
    this.endPanel.isVisible = false;
  }

  hideAll(): void {
    this.startPanel.isVisible = false;
    this.endPanel.isVisible = false;
  }

  /** Ekran pobjede: bodovi su preostale sekunde. */
  showWin(score: number, best: number, roomLabel: string): void {
    this.startPanel.isVisible = false;
    this.endPanel.isVisible = true;
    this.endTitle.text = "Stigao si na vrijeme!";
    this.endTitle.color = "#7ee08a";
    const isRecord = score >= best;
    this.endBody.text =
      `Dvorana ${roomLabel}\n` +
      `Bodovi: ${score} (preostale sekunde)\n` +
      `Najbolji rezultat: ${best}${isRecord ? "  novi rekord" : ""}`;
    this.endButton.isVisible = true;
  }

  /** Ekran poraza. */
  showLose(best: number, roomLabel: string): void {
    this.startPanel.isVisible = false;
    this.endPanel.isVisible = true;
    this.endTitle.text = "Zakasnio si. Ispit si pao.";
    this.endTitle.color = "#ff6b6b";
    this.endBody.text =
      `Trazio si dvoranu ${roomLabel}.\n` + `Najbolji rezultat: ${best}`;
    this.endButton.isVisible = true;
  }

  dispose(): void {
    this.startPanel.dispose();
    this.endPanel.dispose();
  }
}

/** Ucitava najbolji rezultat; localStorage zna biti nedostupan u privatnom nacinu. */
export function loadHighscore(): number {
  try {
    const raw = window.localStorage.getItem(ROUND.HIGHSCORE_KEY);
    const value = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

/** Sprema najbolji rezultat ako je bolji od dosadasnjeg. */
export function saveHighscore(score: number): number {
  const best = Math.max(loadHighscore(), score);
  try {
    window.localStorage.setItem(ROUND.HIGHSCORE_KEY, String(best));
  } catch {
    // Bez trajnog spremanja igra i dalje radi.
  }
  return best;
}

function createOverlay(name: string): Rectangle {
  const panel = new Rectangle(name);
  panel.width = 1;
  panel.height = 1;
  panel.thickness = 0;
  panel.background = "rgba(8, 11, 16, 0.86)";
  return panel;
}

function makeText(
  text: string,
  fontSize: number,
  color: string,
  options: { bold?: boolean } = {},
): TextBlock {
  const block = new TextBlock("", text);
  block.color = color;
  block.fontSize = fontSize;
  if (options.bold) block.fontWeight = "bold";
  block.width = "100%";
  block.textWrapping = true;
  // Visinu racuna sam prema tekstu; fiksna visina bi na uskom ekranu odrezala
  // redove koji se prelome.
  block.resizeToFit = true;
  block.lineSpacing = "4px";
  return block;
}

function makeButton(name: string, label: string, background: string): Button {
  const button = Button.CreateSimpleButton(name, label);
  button.width = "300px";
  button.height = "58px";
  button.color = "#ffffff";
  button.background = background;
  button.cornerRadius = 12;
  button.thickness = 0;
  button.fontSize = 24;
  button.fontWeight = "bold";
  button.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  if (button.textBlock) button.textBlock.resizeToFit = false;
  return button;
}
