import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center justify-center p-20 space-y-4">
          <div className="text-rose-500 text-5xl">⚠️</div>
          <p className="text-white font-bold text-sm uppercase tracking-widest">
            Error al cargar el módulo
          </p>
          <p className="text-white/40 text-xs text-center max-w-xs">
            {this.state.error?.message || 'Error desconocido'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 bg-primary text-black text-xs font-black uppercase tracking-widest rounded-xl"
          >
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
