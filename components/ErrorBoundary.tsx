
import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  // Explicitly declare props to satisfy TS in strict mode where inheritance might be inferred narrowly
  declare props: Readonly<Props>;

  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[9999] bg-slate-950 flex items-center justify-center p-6 text-white font-sans">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-lg w-full shadow-2xl backdrop-blur-md flex flex-col items-center text-center">
            
            <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </div>

            <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
            
            <p className="text-slate-400 mb-6 text-sm leading-relaxed max-w-md">
              PrismaTonal encountered an unexpected issue. This might be due to a recent update, corrupted settings, or a browser compatibility glitch.
            </p>
            
            <div className="w-full bg-slate-950 p-3 rounded border border-slate-800 text-[10px] font-mono text-red-400 overflow-auto max-h-32 mb-8 text-left whitespace-pre-wrap shadow-inner">
              {this.state.error?.message || this.state.error?.toString()}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full">
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-lg transition-colors text-sm"
                >
                  Reload App
                </button>
                <button
                  onClick={() => { localStorage.clear(); window.location.reload(); }}
                  className="flex-1 px-4 py-3 bg-slate-800 hover:bg-red-900/50 hover:text-red-200 text-slate-400 font-bold rounded-lg border border-slate-700 transition-colors text-sm"
                >
                  Reset All Settings
                </button>
            </div>
            <p className="text-[10px] text-slate-600 mt-4">Warning: Resetting settings will clear saved chords and custom presets.</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
