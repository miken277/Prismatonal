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
        <div className="fixed inset-0 z-[9999] bg-slate-900 flex items-center justify-center p-8 text-white font-sans">
          <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-8 max-w-2xl w-full shadow-2xl backdrop-blur-md">
            <h1 className="text-2xl font-bold text-red-400 mb-4 flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              System Error
            </h1>
            <p className="text-slate-300 mb-6 text-sm leading-relaxed">
              The application encountered an unexpected error. This might be due to a recent update, data corruption, or a browser compatibility issue.
            </p>
            
            <div className="bg-black/50 p-4 rounded-lg border border-red-900/30 text-[10px] font-mono text-red-300 overflow-auto max-h-64 mb-6 whitespace-pre-wrap shadow-inner">
              {this.state.error?.toString()}
            </div>
            
            <div className="flex gap-4">
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded shadow-lg transition-colors text-sm uppercase tracking-wide"
                >
                  Reload Application
                </button>
                <button
                  onClick={() => { localStorage.clear(); window.location.reload(); }}
                  className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded shadow-lg transition-colors text-sm uppercase tracking-wide"
                >
                  Reset Settings & Reload
                </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
