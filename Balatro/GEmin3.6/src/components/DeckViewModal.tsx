import React from 'react';
import { type CardData, SUIT_SYMBOLS, SUIT_COLORS } from '../engine/cardDefs';

interface DeckViewModalProps {
  deck: CardData[];
  onClose: () => void;
}

export const DeckViewModal: React.FC<DeckViewModalProps> = ({ deck, onClose }) => {
  const suitCounts = {
    spades: deck.filter((c) => c.suit === 'spades').length,
    hearts: deck.filter((c) => c.suit === 'hearts').length,
    clubs: deck.filter((c) => c.suit === 'clubs').length,
    diamonds: deck.filter((c) => c.suit === 'diamonds').length,
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border-2 border-slate-700 w-full max-w-2xl rounded-2xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
          <h2 className="text-xl font-extrabold text-amber-400 flex items-center gap-2">
            <span>🎴</span> FULL DECK INSPECTOR ({deck.length} CARDS LEFT)
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white font-extrabold text-xl px-2 rounded"
          >
            ✕
          </button>
        </div>

        {/* Suit Summary Bar */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {(['spades', 'hearts', 'clubs', 'diamonds'] as const).map((suit) => (
            <div
              key={suit}
              className="bg-slate-950 border border-slate-800 p-2 rounded-xl flex items-center justify-between"
            >
              <span className="text-lg font-bold" style={{ color: SUIT_COLORS[suit].main }}>
                {SUIT_SYMBOLS[suit]} {suit.toUpperCase()}
              </span>
              <span className="text-base font-mono font-extrabold text-white">{suitCounts[suit]}</span>
            </div>
          ))}
        </div>

        {/* Card Grid */}
        <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-6 sm:grid-cols-8 gap-2">
          {deck.map((card) => (
            <div
              key={card.id}
              className="bg-slate-950 border border-slate-800 rounded p-1.5 flex flex-col items-center justify-center text-xs font-mono"
            >
              <span className="font-bold" style={{ color: SUIT_COLORS[card.suit].main }}>
                {card.rank === 14 ? 'A' : card.rank === 13 ? 'K' : card.rank === 12 ? 'Q' : card.rank === 11 ? 'J' : card.rank}
                {SUIT_SYMBOLS[card.suit]}
              </span>
              {card.enhancement !== 'none' && (
                <span className="text-[8px] text-amber-400 uppercase">{card.enhancement}</span>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl border border-slate-600 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
