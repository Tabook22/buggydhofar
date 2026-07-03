import { Component, ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-forest-950 p-6 text-white">
          <div className="max-w-lg rounded-[2rem] border border-red-400/30 bg-red-500/10 p-8 text-center">
            <h1 className="text-2xl font-black text-red-200">Something went wrong</h1>
            <p className="mt-4 text-sm text-white/70">{this.state.error.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 rounded-2xl bg-forest-500 px-5 py-3 font-bold text-white"
            >
              Reload page
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
