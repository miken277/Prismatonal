
import React, { useState } from 'react';

interface Props {
  onStart: () => void;
}

const SplashScreen: React.FC<Props> = ({ onStart }) => {
  const [isFading, setIsFading] = useState(false);

  const handleStart = () => {
    setIsFading(true);
    setTimeout(onStart, 500); // Allow fade animation to complete
  };

  if (isFading) {
      return (
          <div className="fixed inset-0 z-[9999] bg-slate-950 pointer-events-none transition-opacity duration-500 opacity-0" />
      );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans select-none">
      <div className="relative flex flex-col items-center animate-in fade-in zoom-in duration-700">
        
        {/* Logo Graphic */}
        <div className="w-32 h-32 mb-8 relative">
            <div className="absolute inset-0 border-4 border-blue-500 rounded-full opacity-20 animate-ping"></div>
            <div className="absolute inset-0 border-4 border-indigo-500 rounded-full flex items-center justify-center bg-slate-900 shadow-[0_0_50px_rgba(59,130,246,0.3)]">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
            </div>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-300 text-center">
          PrismaTonal
        </h1>
        <p className="text-slate-400 text-sm md:text-base tracking-widest uppercase mb-12 text-center">
          Microtonal Lattice Synthesizer
        </p>

        <button 
            onClick={handleStart}
            className="group relative px-8 py-4 bg-transparent overflow-hidden rounded-full transition-all hover:scale-105 active:scale-95"
        >
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-600 to-indigo-600 opacity-80 group-hover:opacity-100 transition-opacity"></div>
            <div className="absolute inset-0 w-full h-full border border-white/20 rounded-full"></div>
            <span className="relative text-lg font-bold tracking-wider text-white">ENTER STUDIO</span>
        </button>

        <div className="mt-16 text-[10px] text-slate-600 font-mono">
            v1.0.0 &bull; Web Audio API &bull; Just Intonation
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
