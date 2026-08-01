import React from 'react';
import type { JokerData } from '../engine/jokerDefs';
import type { ConsumableData } from '../engine/tarotDefs';
import { JokerCard } from './JokerCard';

interface ShopViewProps {
  money: number;
  shopJokers: JokerData[];
  shopConsumables: ConsumableData[];
  rerollCost: number;
  onBuyJoker: (joker: JokerData) => void;
  onBuyConsumable: (consumable: ConsumableData) => void;
  onReroll: () => void;
  onNextRound: () => void;
  userJokers: JokerData[];
  userConsumables: ConsumableData[];
  onSellJoker: (id: string) => void;
}

export const ShopView: React.FC<ShopViewProps> = ({
  money,
  shopJokers,
  shopConsumables,
  rerollCost,
  onBuyJoker,
  onBuyConsumable,
  onReroll,
  onNextRound,
  userJokers,
  userConsumables,
  onSellJoker,
}) => {
  const bankInterest = Math.min(5, Math.floor(money / 5));

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto p-4 flex flex-col justify-between z-10 select-none">
      {/* Header Banner */}
      <div className="flex items-center justify-between bg-slate-900/90 border-2 border-indigo-500/80 p-4 rounded-2xl shadow-2xl backdrop-blur-md mb-4">
        <div>
          <h2 className="text-2xl font-extrabold text-indigo-300 tracking-wider flex items-center gap-2">
            <span>🛒</span> SHOP PHASE
          </h2>
          <p className="text-xs text-indigo-200 mt-0.5">
            Buy Jokers and Planet/Tarot cards to upgrade your deck! (Bank interest: +${bankInterest} at round start)
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-amber-500/20 border border-amber-400/50 px-4 py-2 rounded-xl flex items-center gap-2">
            <span className="text-sm font-bold text-amber-300">Money:</span>
            <span className="text-2xl font-extrabold text-yellow-400 font-mono">${money}</span>
          </div>

          <button
            onClick={onNextRound}
            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-base rounded-xl border-2 border-emerald-300 shadow-xl transition-all active:scale-95 cursor-pointer"
          >
            NEXT BLIND ➔
          </button>
        </div>
      </div>

      {/* Main Shop Shelf */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-auto">
        {/* Left: Available Jokers for Sale */}
        <div className="bg-slate-950/80 border-2 border-slate-700 p-4 rounded-2xl backdrop-blur-sm flex flex-col shadow-xl">
          <h3 className="text-sm font-extrabold text-yellow-400 mb-3 uppercase tracking-wider flex items-center gap-2">
            <span>🃏</span> Jokers for Sale
          </h3>
          <div className="flex flex-wrap gap-4 items-center justify-start min-h-[170px]">
            {shopJokers.length === 0 ? (
              <span className="text-gray-400 text-sm italic m-auto">Sold out! Try rerolling shop.</span>
            ) : (
              shopJokers.map((joker) => (
                <JokerCard
                  key={joker.id}
                  joker={joker}
                  inShop={true}
                  disabledBuy={money < joker.cost || userJokers.length >= 5}
                  onBuy={() => onBuyJoker(joker)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: Available Consumables (Planet / Tarot Cards) */}
        <div className="bg-slate-950/80 border-2 border-slate-700 p-4 rounded-2xl backdrop-blur-sm flex flex-col shadow-xl">
          <h3 className="text-sm font-extrabold text-purple-300 mb-3 uppercase tracking-wider flex items-center gap-2">
            <span>🔮</span> Celestial & Tarot Cards
          </h3>
          <div className="flex flex-wrap gap-4 items-center justify-start min-h-[170px]">
            {shopConsumables.length === 0 ? (
              <span className="text-gray-400 text-sm italic m-auto">Sold out!</span>
            ) : (
              shopConsumables.map((item) => (
                <div
                  key={item.id}
                  style={{ background: item.bgGradient }}
                  className="w-28 h-40 rounded-xl border-2 border-purple-400/80 p-2 flex flex-col justify-between shadow-xl cursor-pointer select-none"
                >
                  <div className="flex justify-between items-center">
                    <span className="bg-purple-900/90 text-purple-200 text-[9px] font-bold px-1.5 py-0.5 rounded">
                      {item.type}
                    </span>
                  </div>

                  <div className="flex flex-col items-center justify-center my-1 text-center">
                    <span className="text-3xl filter drop-shadow mb-1">{item.iconSymbol}</span>
                    <span className="font-extrabold text-xs text-white leading-tight">{item.name}</span>
                  </div>

                  <div className="bg-black/60 rounded p-1 text-[9px] text-purple-100 text-center leading-tight">
                    {item.description}
                  </div>

                  <button
                    onClick={() => onBuyConsumable(item)}
                    disabled={money < item.cost || userConsumables.length >= 2}
                    className={`mt-1 w-full py-1 text-xs font-bold rounded shadow border ${
                      money < item.cost || userConsumables.length >= 2
                        ? 'bg-gray-700 border-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white active:scale-95 cursor-pointer'
                    }`}
                  >
                    Buy ${item.cost}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Reroll Shop Control */}
      <div className="mt-4 flex justify-center">
        <button
          onClick={onReroll}
          disabled={money < rerollCost}
          className={`px-6 py-2.5 rounded-xl border-2 font-extrabold text-sm shadow-lg flex items-center gap-2 transition-all ${
            money < rerollCost
              ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-amber-600 hover:bg-amber-500 border-amber-300 text-slate-950 active:scale-95 cursor-pointer'
          }`}
        >
          <span>🎲</span> REROLL SHOP (${rerollCost})
        </button>
      </div>

      {/* Bottom Inventory Bar (Held Jokers & Consumables) */}
      <div className="mt-4 bg-slate-900/90 border border-slate-700 p-3 rounded-2xl backdrop-blur-sm flex flex-col md:flex-row justify-between items-center gap-4">
        {/* Held Jokers */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">
            YOUR JOKERS ({userJokers.length}/5):
          </span>
          <div className="flex gap-2 min-w-[200px]">
            {userJokers.map((j) => (
              <JokerCard key={j.id} joker={j} onSell={() => onSellJoker(j.id)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
