import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[IDentix ErrorBoundary caught error]:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-900/40 border border-red-500/50 flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <h1 className="text-xl font-bold mb-2">IDentix Operational Recovery</h1>
          <p className="text-slate-400 text-sm max-w-md mb-6 leading-relaxed">
            An unexpected error occurred in the checkpoint client interface. The session state has been preserved.
          </p>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-left text-xs font-mono text-red-400 max-w-lg overflow-auto mb-6 w-full">
            {this.state.error?.message || 'Unknown runtime error'}
          </div>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.href = '/';
            }}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reload Checkpoint Terminal</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
