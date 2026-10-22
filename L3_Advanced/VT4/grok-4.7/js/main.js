import { createState } from "./state.js";
import { createRenderer } from "./renderer.js";
import { setupUI } from "./ui.js";

const boot = document.getElementById("boot");
const bootText = document.getElementById("boot-text");
const app = document.getElementById("app");

async function main() {
  const state = createState();
  const canvas = document.getElementById("view");
  try {
    const renderer = await createRenderer(canvas, state);
    setupUI(state, renderer);
    boot.hidden = true;
    app.hidden = false;
    renderer.start();
    renderer.onError = (err) => {
      app.hidden = true;
      boot.hidden = false;
      bootText.textContent = err.message || String(err);
    };
  } catch (err) {
    bootText.textContent = err.message || String(err);
  }
}

main();
