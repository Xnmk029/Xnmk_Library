import { useState } from "react";
import type { Game } from "@/game/game";
import { ItemIcon, Slot } from "./HUD";
import { itemDisplay } from "@/game/blocks";

export function InventoryScreen({ game }: { game: Game }) {
  const inv = game.player.inventory;
  const size = game.craftSize;
  const result = game.craftResult();
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<string | null>(null);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-black/55 select-none"
      onMouseMove={(e) => setMouse({ x: e.clientX, y: e.clientY })}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) game.dropCursor();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="mc-panel p-4 text-[#3f3f3f]">
        <div className="flex items-start gap-6 mb-4">
          <div>
            <div className="mc-title mb-1">{size === 3 ? "Crafting" : "Crafting"}</div>
            <div className="flex items-center gap-3">
              <div className="grid" style={{ gridTemplateColumns: `repeat(${size}, 40px)` }}>
                {game.craftGrid.map((s, i) => (
                  <div key={i} onMouseEnter={() => setHover(s ? itemDisplay(s.id) : null)} onMouseLeave={() => setHover(null)}>
                    <Slot stack={s} onClick={(b, sh) => game.slotClick("craft", i, b, sh)} />
                  </div>
                ))}
              </div>
              <div className="text-3xl px-2 text-[#8b8b8b]">→</div>
              <div onMouseEnter={() => setHover(result ? itemDisplay(result.id) : null)} onMouseLeave={() => setHover(null)}>
                <Slot stack={result} size={52} onClick={(b, sh) => game.slotClick("result", 0, b, sh)} />
              </div>
            </div>
          </div>
          {size === 2 && (
            <div className="hidden sm:block text-xs leading-snug text-[#555] max-w-[200px] pt-6">
              Tip: right-click a <b>Crafting Table</b> for the 3×3 grid. Log → Planks → Sticks → Tools & Torches.
            </div>
          )}
        </div>
        <div className="mc-title mb-1">Inventory</div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(9, 40px)" }}>
          {inv.slots.slice(9).map((s, i) => (
            <div key={i} onMouseEnter={() => setHover(s ? itemDisplay(s.id) : null)} onMouseLeave={() => setHover(null)}>
              <Slot stack={s} onClick={(b, sh) => game.slotClick("inv", i + 9, b, sh)} />
            </div>
          ))}
        </div>
        <div className="grid mt-2" style={{ gridTemplateColumns: "repeat(9, 40px)" }}>
          {inv.slots.slice(0, 9).map((s, i) => (
            <div key={i} onMouseEnter={() => setHover(s ? itemDisplay(s.id) : null)} onMouseLeave={() => setHover(null)}>
              <Slot stack={s} onClick={(b, sh) => game.slotClick("inv", i, b, sh)} />
            </div>
          ))}
        </div>
        <div className="text-[11px] text-[#666] mt-3">Left click: pick up / place · Right click: split / place one · Shift+click: quick move · E / Esc: close</div>
      </div>
      {game.cursor && (
        <div className="fixed pointer-events-none" style={{ left: mouse.x - 16, top: mouse.y - 16 }}>
          <ItemIcon stack={game.cursor} size={32} />
        </div>
      )}
      {hover && !game.cursor && (
        <div className="fixed pointer-events-none mc-tooltip" style={{ left: mouse.x + 14, top: mouse.y - 8 }}>
          {hover}
        </div>
      )}
    </div>
  );
}
