import { iconFor } from "@/game/icons";
import type { Game } from "@/game/game";
import type { ItemStack } from "@/game/inventory";
import { itemDisplay } from "@/game/blocks";
import { useEffect, useState } from "react";

export function ItemIcon({ stack, size = 32 }: { stack: ItemStack | null; size?: number }) {
  if (!stack) return null;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <img src={iconFor(stack.id)} alt="" draggable={false} className="pixelated select-none" style={{ width: size, height: size }} />
      {stack.count > 1 && (
        <span className="absolute -bottom-1 -right-0.5 text-white mc-text text-[15px] leading-none font-bold">{stack.count}</span>
      )}
    </div>
  );
}

export function Slot({ stack, selected, onClick, size = 40, dark }: { stack: ItemStack | null; selected?: boolean; onClick?: (button: number, shift: boolean) => void; size?: number; dark?: boolean }) {
  return (
    <div
      onMouseDown={(e) => { e.preventDefault(); onClick?.(e.button, e.shiftKey); }}
      onContextMenu={(e) => e.preventDefault()}
      className={`flex items-center justify-center ${dark ? "mc-slot" : "mc-slot"} ${selected ? "mc-slot-selected" : ""} ${onClick ? "hover:brightness-125 cursor-pointer" : ""}`}
      style={{ width: size, height: size }}
      title={stack ? itemDisplay(stack.id) : undefined}
    >
      <ItemIcon stack={stack} size={size * 0.8} />
    </div>
  );
}

function Heart({ fill }: { fill: 0 | 1 | 2 }) {
  const color = fill === 0 ? "#3a0a0a" : "#ff2a2a";
  return (
    <svg width="18" height="18" viewBox="0 0 9 9" className="pixelated" style={{ imageRendering: "pixelated" }}>
      <path d="M1 1h2v1h1v1h1V2h1V1h2v1h1v3H8v1H7v1H6v1H5v1H4V8H3V7H2V6H1V5H0V2h1z" fill="#111" />
      <path d="M1 1h2v1h1v1h1V2h1V1h2v1h1v3H8v1H7v1H6v1H5v1H4V8H3V7H2V6H1V5H0V2h1z" fill="#000" opacity="0.001" />
      {fill === 2 && <path d="M1 2h2v1h1v1h1V3h1V2h2v2H7v1H6v1H5v1H4V7H3V6H2V5H1z" fill={color} />}
      {fill === 1 && <path d="M1 2h2v1h1v4H3V6H2V5H1z" fill={color} />}
      {fill === 2 && <path d="M2 3h1v1H2z" fill="#ff8a8a" />}
      {fill === 1 && <path d="M2 3h1v1H2z" fill="#ff8a8a" />}
    </svg>
  );
}

export function HUD({ game }: { game: Game }) {
  const p = game.player;
  const inv = p.inventory;
  const health = Math.ceil(p.health);
  const sel = inv.selectedStack();
  const [selName, setSelName] = useState<{ name: string; t: number } | null>(null);
  useEffect(() => {
    if (sel) setSelName({ name: itemDisplay(sel.id), t: Date.now() });
    else setSelName(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel?.id, inv.selected]);
  const showName = selName && Date.now() - selName.t < 2000;

  return (
    <div className="absolute inset-0 pointer-events-none select-none">
      {/* overlays */}
      {game.underwater && <div className="absolute inset-0" style={{ background: "rgba(10, 40, 120, 0.35)" }} />}
      {game.inLava && <div className="absolute inset-0" style={{ background: "rgba(200, 60, 10, 0.75)" }} />}
      {game.hurtFlash > 0 && <div className="absolute inset-0" style={{ background: `rgba(255,0,0,${game.hurtFlash * 0.35})` }} />}
      {game.flash > 0 && <div className="absolute inset-0" style={{ background: `rgba(255,255,255,${game.flash * 0.7})` }} />}
      {/* vignette */}
      <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 120px rgba(0,0,0,0.35)" }} />

      {/* crosshair */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 mix-blend-difference">
        <div className="absolute left-1/2 top-1/2 w-[2px] h-[18px] bg-white -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute left-1/2 top-1/2 w-[18px] h-[2px] bg-white -translate-x-1/2 -translate-y-1/2" />
      </div>

      {/* debug */}
      {game.debug && (
        <div className="absolute left-2 top-2 text-white mc-text text-sm leading-tight bg-black/40 p-2">
          <div>Minecraft-like (three.js) — {game.fps.toFixed(0)} fps</div>
          <div>XYZ: {p.pos.x.toFixed(2)} / {p.pos.y.toFixed(2)} / {p.pos.z.toFixed(2)}</div>
          <div>Chunk: {Math.floor(p.pos.x) >> 4}, {Math.floor(p.pos.z) >> 4} · Biome: {game.biomeName()}</div>
          <div>Light: sky {game.world.getSky(Math.floor(p.pos.x), Math.floor(p.pos.y), Math.floor(p.pos.z))} · block {game.world.getBlockLight(Math.floor(p.pos.x), Math.floor(p.pos.y), Math.floor(p.pos.z))}</div>
          <div>Time: {((game.time % 1) * 24000).toFixed(0)} · Day {(game.day * 100).toFixed(0)}%</div>
          <div>Chunks: {game.world.chunks.size} · Mobs: {game.mobs.mobs.length} · Items: {game.items.items.length}</div>
          {game.target && <div>Target: {itemDisplay(game.target.id)} @ {game.target.x},{game.target.y},{game.target.z}</div>}
          <div>{p.flying ? "Flying" : p.inWater ? "Swimming" : p.onGround ? "On ground" : "Airborne"}</div>
        </div>
      )}

      {/* message */}
      {game.message && (
        <div className="absolute left-1/2 bottom-[110px] -translate-x-1/2 text-white mc-text text-lg">{game.message}</div>
      )}
      {showName && !game.message && (
        <div className="absolute left-1/2 bottom-[92px] -translate-x-1/2 text-white mc-text text-lg">{selName!.name}</div>
      )}

      {/* hearts & hotbar */}
      <div className="absolute left-1/2 bottom-2 -translate-x-1/2 flex flex-col items-start gap-1">
        <div className="flex gap-[1px] ml-1">
          {Array.from({ length: 10 }).map((_, i) => {
            const hp = health - i * 2;
            const fill: 0 | 1 | 2 = hp >= 2 ? 2 : hp === 1 ? 1 : 0;
            return (
              <div key={i} className={p.hurtTime > 0 ? "animate-pulse" : ""}>
                <Heart fill={fill} />
              </div>
            );
          })}
        </div>
        <div className="flex mc-hotbar">
          {inv.slots.slice(0, 9).map((s, i) => (
            <Slot key={i} stack={s} selected={inv.selected === i} size={44} />
          ))}
        </div>
      </div>
    </div>
  );
}
