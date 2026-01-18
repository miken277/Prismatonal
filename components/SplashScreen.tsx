
import React, { useState, useEffect, useRef } from 'react';

interface Props {
  onStart: () => void;
}

const SplashScreen: React.FC<Props> = ({ onStart }) => {
  const [isFading, setIsFading] = useState(false);
  const [performanceScore, setPerformanceScore] = useState<number | null>(null);
  const [isLowPerformance, setIsLowPerformance] = useState(false);
  const hasRunBenchmark = useRef(false);

  useEffect(() => {
      if (hasRunBenchmark.current) return;
      hasRunBenchmark.current = true;

      setTimeout(() => {
          const start = performance.now();
          const duration = 200; 
          let iterations = 0;
          
          // --- Audio Engine Simulation ---
          // Previous tests (Raw Math or Cache Write) failed to catch the iPad 7 bottleneck.
          // Real bottleneck is often Object Property Access + Mixed Float Math + Array Writes.
          // We simulate rendering 32 voices into a 128-sample block (standard Web Audio quantum).
          
          const BLOCK_SIZE = 128;
          const NUM_VOICES = 32; 
          const buffer = new Float32Array(BLOCK_SIZE);
          
          // Create objects to stress property lookup/JIT
          const voices = Array.from({length: NUM_VOICES}, (_, i) => ({
              active: true,
              phase: Math.random(),
              inc: 0.01 + (i * 0.0001),
              gain: 0.5 - (i * 0.01)
          }));
          
          while (performance.now() - start < duration) {
              // Reset buffer (simulating 'fill(0)')
              for(let k=0; k<BLOCK_SIZE; k++) buffer[k] = 0;

              // Render Voices
              for (let v = 0; v < NUM_VOICES; v++) {
                  const voice = voices[v];
                  // Optimization barrier: Local vars to check if JIT handles property access well
                  let p = voice.phase;
                  const inc = voice.inc;
                  const g = voice.gain;

                  for (let i = 0; i < BLOCK_SIZE; i++) {
                      p += inc;
                      if (p >= 1.0) p -= 1.0;
                      // Math.sin is the heavy lifter, plus array write
                      buffer[i] += Math.sin(p * 6.28318) * g;
                  }
                  
                  // Write back state
                  voice.phase = p;
              }
              iterations++;
          }

          // Score = Audio Blocks Rendered in 200ms
          // Realtime requirement: ~375 blocks/sec
          // In 200ms (0.2s), realtime is 75 blocks.
          // A robust device should be able to run at least 20x - 50x realtime to handle UI overhead + GC.
          // Target: > 1500 iterations (blocks) in 200ms.
          
          // Based on user data:
          // i5 Unplugged (Pop) vs Plugged (Stable).
          // Assuming i5 Unplugged runs ~50% speed of Plugged.
          // We set threshold conservatively.
          
          setPerformanceScore(iterations);

          // Threshold Heuristic:
          // If a device cannot render 3000 blocks in 200ms (roughly 200x realtime for audio thread, 
          // but main thread is slower/busy), it will likely glitch when UI interactions occur.
          if (iterations < 2500) {
              setIsLowPerformance(true);
          }
      }, 500);
  }, []);

  const handleStart = () => {
    setIsFading(true);
    setTimeout(onStart, 500); // Allow fade animation to complete
  };

  const formatScore = (score: number) => {
      return score.toFixed(0) + ' blks';
  };

  if (isFading) {
      return (
          <div className="fixed inset-0 z-[9999] bg-slate-950 pointer-events-none transition-opacity duration-500 opacity-0" />
      );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans select-none">
      <div className="relative flex flex-col items-center animate-in fade-in zoom-in duration-700 max-w-md w-full">
        
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
        <p className="text-slate-400 text-sm md:text-base tracking-widest uppercase mb-8 text-center">
          Microtonal Lattice Synthesizer
        </p>

        {isLowPerformance && (
            <div className="mb-8 w-full bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-4 flex items-start gap-3 animate-in slide-in-from-bottom-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="text-left">
                    <h3 className="text-sm font-bold text-yellow-200">Device Performance Warning</h3>
                    <p className="text-xs text-yellow-400/80 mt-1 leading-relaxed">
                        Your device performance score ({performanceScore ? formatScore(performanceScore) : '...'}) is below the recommended threshold (2500). 
                        You may experience audio crackling or dropouts.
                    </p>
                    <p className="text-[10px] text-yellow-500/60 mt-2 uppercase font-bold tracking-wider">
                        Recommended: Desktop CPU or Recent iPad
                    </p>
                </div>
            </div>
        )}

        <button 
            onClick={handleStart}
            className="group relative px-8 py-4 bg-transparent overflow-hidden rounded-full transition-all hover:scale-105 active:scale-95"
        >
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-600 to-indigo-600 opacity-80 group-hover:opacity-100 transition-opacity"></div>
            <div className="absolute inset-0 w-full h-full border border-white/20 rounded-full"></div>
            <span className="relative text-lg font-bold tracking-wider text-white">ENTER STUDIO</span>
        </button>

        <div className="mt-16 text-[10px] text-slate-600 font-mono flex items-center gap-2">
            <span>v1.0.0 &bull; Web Audio API</span>
            {performanceScore && (
                <span className={`px-1 rounded ${isLowPerformance ? 'text-yellow-600' : 'text-slate-600'}`}>
                    Perf: {formatScore(performanceScore)}
                </span>
            )}
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
