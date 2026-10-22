import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Game } from "./game/game";
import { HUD } from "./components/HUD";
import { InventoryScreen } from "./components/InventoryScreen";
import { DeathScreen, LoadingScreen, PauseScreen, TitleScreen } from "./components/Menus";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let g: Game | null = null;
    try {
      g = new Game(canvas);
      g.start();
      setGame(g);
    } catch (e) {
      console.error(e);
    }
    return () => {
      g?.dispose();
    };
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <canvas ref={canvasRef} className="block w-full h-full" />
      {game && <GameUI game={game} />}
    </div>
  );
}

function GameUI({ game }: { game: Game }) {
  useSyncExternalStore(game.subscribe, () => game.version);
  const screen = game.screen;
  return (
    <>
      {screen !== "loading" && screen !== "title" && <HUD game={game} />}
      {screen === "loading" && <LoadingScreen game={game} />}
      {screen === "title" && <TitleScreen game={game} />}
      {screen === "paused" && <PauseScreen game={game} />}
      {(screen === "inventory" || screen === "crafting") && <InventoryScreen game={game} />}
      {screen === "dead" && <DeathScreen game={game} />}
    </>
  );
}
