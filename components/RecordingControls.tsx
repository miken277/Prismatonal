import React, { useState, useEffect, useRef } from 'react';
import { recordingService } from '../services/RecordingService';
import { useStore } from '../services/Store';

const RecordingControls: React.FC = () => {
  const { settings } = useStore();
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const timerRef = useRef<number | null>(null);

  // Format seconds to MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleToggleRecord = async () => {
    if (isRecording) {
      handleStop();
    } else {
      setErrorMsg(null);
      try {
        await recordingService.startRecording();
        setIsRecording(true);
        setDuration(0);
        
        timerRef.current = window.setInterval(() => {
          setDuration(prev => prev + 1);
        }, 1000);

      } catch (e: any) {
        console.error("Recording Error:", e);
        let msg = "Capture Failed";
        if (e.name === 'NotAllowedError') msg = "Permission Denied";
        setErrorMsg(msg);
        setTimeout(() => setErrorMsg(null), 3000);
      }
    }
  };

  const handleStop = () => {
    recordingService.stopRecording();
    setIsRecording(false);
    
    if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
    }
  };

  useEffect(() => {
      return () => {
          if (timerRef.current) clearInterval(timerRef.current);
      };
  }, []);

  if (!settings.enableAudioRecording) return null;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[160] transition-all duration-300 flex flex-col items-center gap-2 pointer-events-none">
        
        {/* Error Toast */}
        {errorMsg && (
            <div className="bg-red-900/90 text-red-200 text-[10px] font-bold px-3 py-1 rounded-full animate-bounce shadow-lg pointer-events-auto border border-red-700 whitespace-nowrap">
                {errorMsg}
            </div>
        )}

        <div className={`pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-full shadow-2xl flex items-center overflow-hidden transition-all ease-out duration-300 ${isExpanded || isRecording ? 'px-1 py-1 pr-4' : 'px-1 py-1'} ${isRecording ? 'border-red-900/50 shadow-[0_0_20px_rgba(220,38,38,0.2)]' : ''}`}>
            
            {/* Main Record Button (Compact) */}
            <button 
                onClick={handleToggleRecord}
                onMouseEnter={() => !isRecording && setIsExpanded(true)}
                className={`relative flex items-center justify-center rounded-full transition-all duration-300 group ${isRecording ? 'w-8 h-8 bg-slate-800 border border-slate-600' : 'w-8 h-8 bg-red-600 hover:bg-red-500 hover:scale-105 shadow-md border border-red-400/50'}`}
            >
                {isRecording ? (
                    <div className="w-2.5 h-2.5 bg-red-500 rounded-sm animate-pulse shadow-[0_0_8px_red]"></div>
                ) : (
                    <div className={`rounded-full bg-white transition-all duration-300 ${isExpanded ? 'w-2 h-2' : 'w-3 h-3'}`}></div>
                )}
            </button>

            {/* Status / Info Section */}
            
            {/* Recording Status (Visible when Recording) */}
            {isRecording && (
                <div className="flex flex-col ml-3 mr-1">
                    <span className="text-[9px] font-mono font-bold text-red-400 animate-pulse leading-none tracking-wider mb-0.5">REC</span>
                    <span className="text-[10px] font-mono font-bold text-white leading-none">{formatTime(duration)}</span>
                </div>
            )}
            
            {/* Idle Label (Visible on Hover/Expand) */}
            {isExpanded && !isRecording && (
                <div className="ml-2 flex flex-col justify-center" onMouseLeave={() => setIsExpanded(false)}>
                    <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest leading-none">Record</span>
                    <span className="text-[8px] text-slate-500 leading-none mt-0.5">Internal Audio</span>
                </div>
            )}
        </div>
    </div>
  );
};

export default RecordingControls;