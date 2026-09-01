import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <div className="card max-w-lg p-8 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-danger">Console error</p>
          <h1 className="mt-3 font-sans text-3xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-zinc-400">The admin panel hit an unexpected error. You can retry or return to the dashboard.</p>
          <div className="mt-6 flex justify-center gap-2">
            <button
              type="button"
              className="rounded-full border border-white/12 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em]"
              onClick={() => this.setState({ error: null })}
            >
              Retry
            </button>
            <a
              href="/"
              className="rounded-full border border-accent/40 bg-accent/15 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-accent"
            >
              Go to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }
}
