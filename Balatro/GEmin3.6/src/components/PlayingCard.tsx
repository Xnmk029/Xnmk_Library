import React, { useState } from 'react';
import { type CardData, RANK_NAMES, RANK_CHIPS, SUIT_SYMBOLS, SUIT_COLORS } from '../engine/cardDefs';
import { soundEngine } from '../audio/soundEngine';

interface PlayingCardProps {
  card: CardData;
  isSelected?: boolean;
  isScoring?: boolean;
  onClick?: () => void;
  small?: boolean;
  disabled?: boolean;
}

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  isSelected = false,
  isScoring = false,
  onClick,
  small = false,
  disabled = false,
}) => {
  const [transform, setTransform] = useState<string>('perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)');

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || card.isFlipped) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    const rotX = (-y / rect.height) * 20;
    const rotY = (x / rect.width) * 20;

    const scale = isSelected ? 1.1 : 1.05;
    setTransform(`perspective(600px) rotateX(${rotX.toFixed(1)}deg) rotateY(${rotY.toFixed(1)}deg) scale(${scale})`);
  };

  const handleMouseEnter = () => {
    if (!disabled) {
      soundEngine.playHover();
    }
  };

  const handleMouseLeave = () => {
    setTransform(`perspective(600px) rotateX(0deg) rotateY(0deg) scale(${isSelected ? 1.08 : 1})`);
  };

  const handleClick = () => {
    if (disabled) return;
    if (isSelected) {
      soundEngine.playDeselect();
    } else {
      soundEngine.playSelect();
    }
    if (onClick) onClick();
  };

  const suitColor = SUIT_COLORS[card.suit];
  const suitSymbol = SUIT_SYMBOLS[card.suit];
  const rankName = RANK_NAMES[card.rank];
  const baseChips = RANK_CHIPS[card.rank];

  // Card dimension sizing
  const cardWidth = small ? 'w-16 h-24 text-xs' : 'w-24 h-36 md:w-28 md:h-40 text-sm';

  // Edition classes
  let editionClass = '';
  if (card.edition === 'foil') editionClass = 'card-foil-shine';
  if (card.edition === 'holographic') editionClass = 'card-holo-glow';
  if (card.edition === 'polychrome') editionClass = 'card-poly-rainbow';

  // Enhancement classes
  let enhancementBadge = null;
  if (card.enhancement === 'bonus') enhancementBadge = <span className="bg-blue-600 text-white px-1 rounded text-[10px] font-bold">+30 CHIPS</span>;
  if (card.enhancement === 'mult') enhancementBadge = <span className="bg-red-600 text-white px-1 rounded text-[10px] font-bold">+4 MULT</span>;
  if (card.enhancement === 'wild') enhancementBadge = <span className="bg-purple-600 text-white px-1 rounded text-[10px] font-bold">WILD</span>;
  if (card.enhancement === 'glass') enhancementBadge = <span className="bg-cyan-300 text-black px-1 rounded text-[10px] font-bold">X2 GLASS</span>;
  if (card.enhancement === 'steel') enhancementBadge = <span className="bg-gray-400 text-black px-1 rounded text-[10px] font-bold">X1.5 STEEL</span>;
  if (card.enhancement === 'stone') enhancementBadge = <span className="bg-amber-800 text-white px-1 rounded text-[10px] font-bold">+50 STONE</span>;
  if (card.enhancement === 'gold') enhancementBadge = <span className="bg-yellow-400 text-black px-1 rounded text-[10px] font-bold">+$3 GOLD</span>;
  if (card.enhancement === 'lucky') enhancementBadge = <span className="bg-emerald-500 text-white px-1 rounded text-[10px] font-bold">LUCKY</span>;

  // Seal rendering
  let sealBadge = null;
  if (card.seal !== 'none') {
    const sealColors: Record<string, string> = {
      gold: 'bg-yellow-400 border-yellow-200',
      red: 'bg-red-500 border-red-200',
      blue: 'bg-blue-500 border-blue-200',
      purple: 'bg-purple-500 border-purple-200',
    };
    sealBadge = (
      <div className={`absolute -top-2 -right-2 w-5 h-5 rounded-full border-2 ${sealColors[card.seal]} shadow-md flex items-center justify-center text-[9px] font-bold text-white z-20`}>
        ★
      </div>
    );
  }

  // Flipped card back view
  if (card.isFlipped) {
    return (
      <div
        className={`relative ${cardWidth} rounded-lg bg-red-800 border-2 border-red-400 shadow-xl flex flex-col items-center justify-center p-2 cursor-default select-none transition-all duration-200`}
        style={{
          backgroundImage: 'radial-gradient(circle, #b7094c 20%, #800f2f 80%)',
        }}
      >
        <div className="w-full h-full border border-red-300 border-dashed rounded flex items-center justify-center opacity-60">
          <span className="text-2xl text-red-200 font-bold">🎴</span>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: isSelected
          ? 'translateY(-16px) scale(1.05)'
          : isScoring
          ? 'translateY(-28px) scale(1.15)'
          : transform,
        transition: 'transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.15s ease',
      }}
      className={`relative ${cardWidth} rounded-xl border-2 select-none cursor-pointer p-1.5 flex flex-col justify-between shadow-2xl transition-all duration-150 ${
        isSelected
          ? 'border-yellow-300 ring-4 ring-yellow-400/50 shadow-yellow-500/30'
          : card.isDebuffed
          ? 'border-gray-600 bg-gray-900 opacity-60 filter grayscale'
          : 'border-white/80 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 hover:border-amber-300'
      } ${editionClass}`}
    >
      {sealBadge}

      {/* Top Left Rank & Suit */}
      <div className="flex flex-col items-start leading-none z-10">
        <span className="font-extrabold text-base md:text-lg tracking-tighter" style={{ color: suitColor.main }}>
          {card.enhancement === 'stone' ? '🗿' : rankName}
        </span>
        <span className="text-sm md:text-base leading-none" style={{ color: suitColor.main }}>
          {card.enhancement === 'stone' ? '' : suitSymbol}
        </span>
      </div>

      {/* Center Art / Symbol */}
      <div className="flex-1 flex flex-col items-center justify-center my-0.5 z-10">
        <span className="text-3xl md:text-4xl drop-shadow-md transition-transform duration-200 hover:scale-110" style={{ color: suitColor.main }}>
          {card.enhancement === 'stone' ? '🧱' : suitSymbol}
        </span>
        {!small && (
          <div className="mt-1 flex flex-col items-center gap-0.5">
            {enhancementBadge}
            <span className="text-[10px] text-blue-300 font-mono font-semibold">
              +{card.enhancement === 'stone' ? 50 : card.enhancement === 'bonus' ? baseChips + 30 : baseChips}
            </span>
          </div>
        )}
      </div>

      {/* Bottom Right Inverted Rank & Suit */}
      <div className="flex flex-col items-end leading-none rotate-180 z-10">
        <span className="font-extrabold text-base md:text-lg tracking-tighter" style={{ color: suitColor.main }}>
          {card.enhancement === 'stone' ? '🗿' : rankName}
        </span>
        <span className="text-sm md:text-base leading-none" style={{ color: suitColor.main }}>
          {card.enhancement === 'stone' ? '' : suitSymbol}
        </span>
      </div>

      {/* Debuffed Overlay */}
      {card.isDebuffed && (
        <div className="absolute inset-0 bg-black/70 rounded-xl flex items-center justify-center z-30">
          <span className="text-red-500 font-bold text-xs bg-black/90 px-2 py-1 rounded border border-red-600">DEBUFFED</span>
        </div>
      )}
    </div>
  );
};
