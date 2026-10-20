import "./style.css";

import { Engine } from "@babylonjs/core/Engines/engine";
import { Game } from "./game/Game";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement | null;
if (!canvas) throw new Error("Nema canvasa #renderCanvas u index.html");

const engine = new Engine(
  canvas,
  true,
  {
    stencil: true,
    // Bez ovoga Safari ponekad izgubi kontekst pri promjeni orijentacije.
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
    // Igra sama ogranicava rezoluciju preko hardwareScalingLevel.
    adaptToDeviceRatio: false,
  },
  true,
);

// Na mobitelu renderiramo ispod pune rezolucije ekrana da FPS ostane stabilan.
const dpr = window.devicePixelRatio || 1;
engine.setHardwareScalingLevel(Math.max(1, Math.min(dpr, 2) * 0.75));

const game = new Game(engine, canvas);

if (import.meta.env.DEV) {
  // Pomoc pri razvoju: scena i igra dostupne su iz konzole preglednika.
  (window as unknown as Record<string, unknown>).igra = game;
}

engine.runRenderLoop(() => game.render());

/*
 * Engine racuna velicinu slike iz velicine canvasa u trenutku stvaranja, a
 * stilovi se u razvojnom nacinu ubacuju tek nakon izvrsavanja modula. Zato
 * pratimo stvarnu velicinu canvasa i javljamo je engineu; isti promatrac
 * pokriva i promjenu velicine prozora te rotaciju mobitela.
 */
if (typeof ResizeObserver !== "undefined") {
  new ResizeObserver(() => engine.resize()).observe(canvas);
} else {
  window.addEventListener("resize", () => engine.resize());
}

// iOS Safari mijenja visinu viewporta pri rotaciji s odgodom.
window.addEventListener("orientationchange", () => {
  window.setTimeout(() => engine.resize(), 250);
});

// Prvi kadar nakon sto se stilovi primijene.
requestAnimationFrame(() => engine.resize());

window.addEventListener("beforeunload", () => game.dispose());
