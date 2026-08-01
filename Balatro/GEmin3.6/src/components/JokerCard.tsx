import React, { useState } from 'react';
import type { JokerData } from '../engine/jokerDefs';
import { soundEngine } from '../audio/soundEngine';

interface JokerCardProps {
  joker: JokerData;
  isTriggered?: boolean;
  triggerMessage?: string | null;
  onSell?: () => void;
  inShop?: boolean;
  onBuy?: () => void;
  disabledBuy?: boolean;
}

export const JokerCard: React.FC<JokerCardProps> = ({
  joker,
  isTriggered = false,
  triggerMessage = null,
  onSell,
  inShop = false,
  onBuy,
  disabledBuy = false,
}) => {
  const [transform, setTransform] = useState<string>('perspective(600px) rotateX(0deg) rotateY(0deg)');

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    const rotX = (-y / rect.height) * 15;
    const rotY = (x / rect.width) * 15;

    setTransform(`perspective(600px) rotateX(${rotX.toFixed(1)}deg) rotateY(${rotY.toFixed(1)}deg) scale(1.05)`);
  };

  const handleMouseEnter = () => {
    soundEngine.playHover();
  };

  const handleMouseLeave = () => {
    setTransform('perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)');
  };

  const rarityColors: Record<string, string> = {
    Common: 'bg-blue-600 text-white',
    Uncommon: 'bg-emerald-600 text-white',
    Rare: 'bg-red-600 text-white',
    Legendary: 'bg-purple-600 text-white font-extrabold animate-pulse',
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: isTriggered ? 'translateY(-18px) scale(1.15)' : transform,
        background: joker.bgGradient,
        transition: 'transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.15s ease',
      }}
      className={`relative w-24 h-36 md:w-28 md:h-40 rounded-xl border-2 border-amber-300/80 p-2 flex flex-col justify-between shadow-xl cursor-pointer select-none ${
        isTriggered ? 'ring-4 ring-red-500 shadow-red-500/50' : 'hover:border-yellow-200'
      }`}
    >
      {/* Rarity Pill */}
      <div className="flex justify-between items-center z-10">
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${rarityColors[joker.rarity] || 'bg-gray-700'}`}>
          {joker.rarity}
        </span>
        {!inShop && onSell && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSell();
            }}
            className="text-[9px] bg-red-800 hover:bg-red-700 text-yellow-200 px-1 py-0.5 rounded border border-red-500 transition-colors cursor-pointer"
            title="Sell Joker"
          >
            ${joker.sellValue}
          </button>
        )}
      </div>

      {/* Center Icon & Title */}
      <div className="flex flex-col items-center justify-center my-1 z-10 text-center">
        <span className="text-3xl md:text-4xl filter drop-shadow-md mb-1">{joker.iconSymbol}</span>
        <span className="font-extrabold text-xs text-white leading-tight text-shadow-sm drop-shadow">{joker.name}</span>
      </div>

      {/* Description Snippet */}
      <div className="bg-black/60 backdrop-blur-sm rounded p-1 text-[9px] text-amber-100 leading-tight text-center z-10 border border-amber-500/30">
        {joker.description}
      </div>

      {/* Shop Buy Action */}
      {inShop && onBuy && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onBuy();
          }}
          disabled={disabledBuy}
          className={`mt-1 w-full py-1 text-xs font-bold rounded shadow border ${
            disabledBuy
              ? 'bg-gray-700 border-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white active:scale-95 cursor-pointer'
          }`}
        >
          Buy ${joker.cost}
        </button>
      )}

      {/* Trigger Popup Floating Message */}
      {isTriggered && triggerMessage && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-red-600 text-yellow-200 font-extrabold text-xs px-2.5 py-1 rounded-full shadow-2xl border-2 border-yellow-300 animate-bounce whitespace-nowrap z-30">
          {triggerMessage}
        </div>
      )}
    </div>
  );
};
