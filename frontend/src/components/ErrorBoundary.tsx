import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./ui/Button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", err, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-[50vh] flex items-center justify-center p-6 bg-[color:var(--surface-page)]">
        <div className="max-w-md w-full rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-center space-y-4">
          <div className="flex justify-center text-red-400">
            <AlertTriangle className="w-10 h-10" aria-hidden />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-100">Algo salió mal</h1>
            <p className="text-xs text-slate-500 mt-1">
              La interfaz encontró un error inesperado. Puedes reintentar o recargar la página.
            </p>
            {this.state.message && (
              <pre className="mt-3 text-left text-[11px] text-red-300/90 font-mono whitespace-pre-wrap break-all bg-ops-900/80 p-2 rounded border border-ops-700">
                {this.state.message}
              </pre>
            )}
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button
              size="sm"
              onClick={() => this.setState({ hasError: false, message: undefined })}
            >
              Reintentar
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
              Recargar
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
