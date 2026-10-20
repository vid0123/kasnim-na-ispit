import type { Scene } from "@babylonjs/core/scene";

/**
 * Babylon Inspector na tipku I.
 *
 * Ovaj modul se ucitava samo kad je import.meta.env.DEV istinit. U
 * produkcijskom buildu ta grana otpada, pa Rollup izbaci i ovaj modul i
 * cijeli @babylonjs/inspector (desetak megabajta) iz rezultata.
 */
export function registerInspectorHotkey(scene: Scene): void {
  window.addEventListener("keydown", async (ev) => {
    if (ev.code !== "KeyI" || ev.ctrlKey || ev.metaKey || ev.altKey) return;

    await import("@babylonjs/core/Debug/debugLayer");
    await import("@babylonjs/inspector");

    if (scene.debugLayer.isVisible()) {
      scene.debugLayer.hide();
    } else {
      await scene.debugLayer.show({ embedMode: true, overlay: true });
    }
  });
}
