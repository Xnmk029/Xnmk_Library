import React from 'react';
import confetti from 'canvas-confetti';

interface GameOverModalProps {
  isVictory: boolean;
  ante: number;
  scoreAchieved: number;
  targetScore: number;
  onRestart: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isVictory,
  ante,
  scoreAchieved,
  targetScore,
  onRestart,
}) => {
  React.useEffect(() => {
    if (isVictory) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });
    }
  }, [isVictory]);

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-lg z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border-4 border-amber-400/80 w-full max-w-lg rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in duration-300">
        <div className="text-6xl mb-3 animate-bounce">
          {isVictory ? '🏆' : '💀'}
        </div>

        <h1 className={`text-4xl font-extrabold tracking-wider mb-2 ${isVictory ? 'text-emerald-400' : 'text-red-500'}`}>
          {isVictory ? 'VICTORY!' : 'GAME OVER'}
        </h1>

        <p className="text-gray-300 text-sm mb-6 max-w-xs">
          {isVictory
            ? `Congratulations! You defeated Ante ${ante} and conquered Balatro!`
            : `You failed to reach the required score for Ante ${ante}.`}
        </p>

        {/* Score Stats Card */}
        <div className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 mb-6 flex justify-around">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase font-bold">Score Achieved</span>
            <span className="text-2xl font-extrabold text-yellow-400 font-mono">
              {scoreAchieved.toLocaleString()}
            </span>
          </div>
          <div className="w-px bg-slate-800" />
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase font-bold">Target Score</span>
            <span className="text-2xl font-extrabold text-blue-400 font-mono">
              {targetScore.toLocaleString()}
            </span>
          </div>
        </div>

        <button
          onClick={onRestart}
          className="w-full py-4 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-extrabold text-lg rounded-2xl border-2 border-yellow-300 shadow-2xl active:scale-95 transition-all"
        >
          PLAY AGAIN 🔄
        </button>
      </div>
    </div>
  );
};
