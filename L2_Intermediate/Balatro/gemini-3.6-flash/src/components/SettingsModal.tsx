import React from 'react';
import { soundEngine } from '../audio/soundEngine';

interface SettingsModalProps {
  crtEnabled: boolean;
  setCrtEnabled: (enabled: boolean) => void;
  gameSpeed: number;
  setGameSpeed: (speed: number) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  crtEnabled,
  setCrtEnabled,
  gameSpeed,
  setGameSpeed,
  onClose,
}) => {
  const [muted, setMuted] = React.useState(soundEngine.getMuted());

  const handleToggleMute = () => {
    const isMuted = soundEngine.toggleMute();
    setMuted(isMuted);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border-2 border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl flex flex-col gap-6">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h2 className="text-xl font-extrabold text-yellow-400 flex items-center gap-2">
            <span>⚙️</span> GAME SETTINGS
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white font-extrabold text-xl">
            ✕
          </button>
        </div>

        {/* CRT Scanline Filter Toggle */}
        <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div>
            <span className="font-bold text-sm text-white block">CRT Shader Scanlines</span>
            <span className="text-xs text-gray-400">Authentic retro arcade scanline overlay</span>
          </div>
          <button
            onClick={() => setCrtEnabled(!crtEnabled)}
            className={`px-4 py-1.5 rounded-lg font-bold text-xs transition-colors ${
              crtEnabled ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            {crtEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Animation Speed Selector */}
        <div className="flex flex-col gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
          <span className="font-bold text-sm text-white block">Scoring Animation Speed</span>
          <div className="flex gap-2 mt-1">
            {[1, 2, 4].map((speed) => (
              <button
                key={speed}
                onClick={() => setGameSpeed(speed)}
                className={`flex-1 py-1.5 rounded-lg font-extrabold text-xs transition-colors ${
                  gameSpeed === speed ? 'bg-amber-500 text-slate-950' : 'bg-gray-800 text-gray-300'
                }`}
              >
                {speed}X
              </button>
            ))}
          </div>
        </div>

        {/* Sound FX Toggle */}
        <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div>
            <span className="font-bold text-sm text-white block">8-Bit Sound Effects</span>
            <span className="text-xs text-gray-400">Web Audio API synthesized sound</span>
          </div>
          <button
            onClick={handleToggleMute}
            className={`px-4 py-1.5 rounded-lg font-bold text-xs transition-colors ${
              !muted ? 'bg-blue-600 text-white' : 'bg-red-800 text-red-200'
            }`}
          >
            {!muted ? 'MUTED: NO' : 'MUTED: YES'}
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-base rounded-xl border-2 border-amber-300 shadow-lg active:scale-95"
        >
          APPLY & CLOSE
        </button>
      </div>
    </div>
  );
};
