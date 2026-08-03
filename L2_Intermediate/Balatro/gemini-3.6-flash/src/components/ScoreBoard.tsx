import React from 'react';
import type { BlindType, BossBlindDef } from '../engine/blindDefs';
import type { PokerHandType } from '../engine/pokerEvaluator';

interface ScoreBoardProps {
  ante: number;
  blindType: BlindType;
  bossBlind?: BossBlindDef;
  targetScore: number;
  currentRoundScore: number;
  handsLeft: number;
  discardsLeft: number;
  money: number;
  handName: PokerHandType;
  handLevel: number;
  currentChips: number;
  currentMult: number;
  isScoring: boolean;
}

export const ScoreBoard: React.FC<ScoreBoardProps> = ({
  ante,
  blindType,
  bossBlind,
  targetScore,
  currentRoundScore,
  handsLeft,
  discardsLeft,
  money,
  handName,
  handLevel,
  currentChips,
  currentMult,
  isScoring,
}) => {
  const blindTitles: Record<BlindType, { name: string; color: string }> = {
    small: { name: 'Small Blind', color: 'bg-emerald-600 border-emerald-400' },
    big: { name: 'Big Blind', color: 'bg-amber-600 border-amber-400' },
    boss: { name: bossBlind ? bossBlind.name : 'Boss Blind', color: 'bg-red-700 border-red-500' },
  };

  const currentBlind = blindTitles[blindType];
  const progressPercent = Math.min(100, Math.floor((currentRoundScore / targetScore) * 100));

  return (
    <div className="w-full bg-slate-950/80 backdrop-blur-md border-b-2 border-slate-700 p-3 shadow-2xl z-20 flex flex-col md:flex-row items-center justify-between gap-4">
      {/* Ante & Blind Info Panel */}
      <div className="flex items-center gap-3">
        <div className="bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg flex flex-col items-center shadow-inner">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">ANTE</span>
          <span className="text-xl font-extrabold text-amber-400 leading-none">{ante}<span className="text-sm text-gray-500">/8</span></span>
        </div>

        <div className={`px-4 py-2 rounded-xl border-2 shadow-lg flex flex-col justify-center ${currentBlind.color}`}>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm text-white uppercase tracking-wide">{currentBlind.name}</span>
            {blindType === 'boss' && bossBlind && (
              <span className="text-lg filter drop-shadow">{bossBlind.icon}</span>
            )}
          </div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-[10px] text-gray-200 uppercase">Target:</span>
            <span className="text-base font-extrabold text-yellow-300 font-mono tracking-tight">{targetScore.toLocaleString()}</span>
          </div>
          {blindType === 'boss' && bossBlind && (
            <span className="text-[10px] text-red-200 font-semibold">{bossBlind.description}</span>
          )}
        </div>

        {/* Round Progress Meter */}
        <div className="hidden sm:flex flex-col w-32">
          <div className="flex justify-between text-[10px] text-gray-300 font-mono font-bold mb-1">
            <span>SCORE</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="w-full bg-gray-900 h-3 rounded-full overflow-hidden border border-gray-700 p-0.5">
            <div
              className="bg-gradient-to-r from-blue-500 via-amber-400 to-emerald-400 h-full rounded-full transition-all duration-300 shadow-lg"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-[10px] text-amber-300 font-mono mt-0.5 text-right font-bold">
            {currentRoundScore.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Center Live Hand Chips x Mult Display */}
      <div className="flex items-center gap-2 bg-slate-900/90 border-2 border-slate-700 px-4 py-2 rounded-2xl shadow-inner">
        {/* Hand Title & Level */}
        <div className="flex flex-col items-end pr-2 border-r border-slate-700">
          <span className="text-sm font-extrabold text-yellow-300 tracking-wide">{handName}</span>
          <span className="text-[10px] bg-indigo-900 text-indigo-200 px-1.5 py-0.5 rounded font-bold uppercase">
            lvl.{handLevel}
          </span>
        </div>

        {/* Chips Badge */}
        <div
          className={`flex items-center gap-1.5 bg-blue-600 px-3 py-1.5 rounded-xl border-2 border-blue-400 shadow-md ${
            isScoring ? 'animate-bounce' : ''
          }`}
        >
          <span className="text-xs text-blue-100 font-bold uppercase">CHIPS</span>
          <span className="text-xl font-extrabold text-white font-mono">{currentChips}</span>
        </div>

        <span className="text-xl font-extrabold text-amber-400 px-1">X</span>

        {/* Mult Badge */}
        <div
          className={`flex items-center gap-1.5 bg-red-600 px-3 py-1.5 rounded-xl border-2 border-red-400 shadow-md ${
            isScoring ? 'animate-bounce' : ''
          }`}
        >
          <span className="text-xs text-red-100 font-bold uppercase">MULT</span>
          <span className="text-xl font-extrabold text-white font-mono">{currentMult}</span>
        </div>
      </div>

      {/* Right Stats (Hands, Discards, Money) */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {/* Hands Left */}
          <div className="bg-blue-900/80 border border-blue-500/50 px-3 py-1 rounded-lg flex flex-col items-center shadow-md">
            <span className="text-[9px] text-blue-300 font-bold uppercase">HANDS</span>
            <span className="text-lg font-extrabold text-white">{handsLeft}</span>
          </div>

          {/* Discards Left */}
          <div className="bg-red-900/80 border border-red-500/50 px-3 py-1 rounded-lg flex flex-col items-center shadow-md">
            <span className="text-[9px] text-red-300 font-bold uppercase">DISCARDS</span>
            <span className="text-lg font-extrabold text-white">{discardsLeft}</span>
          </div>
        </div>

        {/* Money Badge */}
        <div className="bg-gradient-to-r from-amber-500 to-yellow-600 border-2 border-yellow-300 px-4 py-1.5 rounded-xl shadow-lg flex items-center gap-1">
          <span className="text-lg">💵</span>
          <span className="text-xl font-extrabold text-slate-950 font-mono">${money}</span>
        </div>
      </div>
    </div>
  );
};
