import type { Game } from "@/game/game";
import { sfx } from "@/game/sfx";

export function McButton({ children, onClick, className = "", disabled }: { children: React.ReactNode; onClick?: () => void; className?: string; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`mc-button ${className}`}>
      {children}
    </button>
  );
}

const CONTROLS: [string, string][] = [
  ["W A S D", "Move"],
  ["Mouse", "Look"],
  ["Space", "Jump / swim up"],
  ["Double-tap W", "Sprint"],
  ["Shift", "Sneak"],
  ["Left click", "Break block / attack"],
  ["Right click", "Place block / use"],
  ["Wheel / 1-9", "Select hotbar slot"],
  ["E", "Inventory (2×2 crafting)"],
  ["Q", "Drop item"],
  ["F", "Toggle flying"],
  ["F3", "Debug info"],
];

export function Controls({ compact }: { compact?: boolean }) {
  return (
    <div className={`grid grid-cols-2 gap-x-6 gap-y-0.5 ${compact ? "text-xs" : "text-sm"} text-gray-200`}>
      {CONTROLS.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 border-b border-white/10 py-0.5">
          <span className="text-yellow-200 font-semibold">{k}</span>
          <span>{v}</span>
        </div>
      ))}
    </div>
  );
}

export function LoadingScreen({ game }: { game: Game }) {
  const pct = Math.round(game.loadingProgress * 100);
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1c1c1c] dirt-bg text-white">
      <div className="mc-logo mb-8">MINECRAFT</div>
      <div className="mc-text text-lg mb-3">Building terrain…</div>
      <div className="w-[320px] h-3 bg-black border-2 border-[#555]">
        <div className="h-full bg-[#5bd15b] transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mc-text text-sm mt-2 opacity-80">{pct}%</div>
      <div className="mt-6 text-xs opacity-60">Generating caves, rivers, ores, forests and lighting</div>
    </div>
  );
}

export function TitleScreen({ game }: { game: Game }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/35 text-white">
      <div className="mc-logo mb-2">MINECRAFT</div>
      <div className="mc-text text-yellow-300 text-sm mb-8 -rotate-6 translate-x-40 -translate-y-6">Web Edition!</div>
      <McButton className="w-[300px] text-lg" onClick={() => game.play()}>Play</McButton>
      <div className="mt-8 bg-black/50 p-4 rounded max-w-[560px]">
        <div className="mc-text text-center mb-2">Controls</div>
        <Controls />
      </div>
      <div className="absolute bottom-2 left-3 text-xs opacity-70 mc-text">Procedural world · seed {game.terrain.seed}</div>
      <div className="absolute bottom-2 right-3 text-xs opacity-70 mc-text">Fan-made · three.js</div>
    </div>
  );
}

export function PauseScreen({ game }: { game: Game }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 text-white">
      <div className="mc-text text-2xl mb-6">Game Menu</div>
      <McButton className="w-[300px]" onClick={() => game.play()}>Back to Game</McButton>
      <div className="flex gap-2 mt-3">
        {[4, 6, 8, 10].map((r) => (
          <McButton key={r} className={`w-[72px] text-xs ${game.renderDistance === r ? "mc-button-active" : ""}`} onClick={() => game.setRenderDistance(r)}>
            {r} chunks
          </McButton>
        ))}
      </div>
      <div className="text-xs mt-1 opacity-70">Render distance</div>
      <McButton className="w-[300px] mt-3 text-sm" onClick={() => { sfx.enabled = !sfx.enabled; game.notify(); }}>
        Sound: {sfx.enabled ? "ON" : "OFF"}
      </McButton>
      <div className="mt-6 bg-black/40 p-3 rounded">
        <Controls compact />
      </div>
    </div>
  );
}

export function DeathScreen({ game }: { game: Game }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-white" style={{ background: "rgba(120, 0, 0, 0.55)" }}>
      <div className="mc-text text-4xl mb-8">You died!</div>
      <McButton className="w-[300px]" onClick={() => game.respawn()}>Respawn</McButton>
    </div>
  );
}
