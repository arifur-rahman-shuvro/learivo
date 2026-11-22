import { Component, type ErrorInfo, type ReactNode } from "react";
import { describeError } from "../../core/errors.ts";
import { reportError } from "../../core/monitoring.ts";
import { Button } from "../primitives/Button.tsx";

interface Props {
  children: ReactNode;
  /** When this changes (a different screen, say) a shown failure is cleared. */
  resetKey?: unknown;
  /** Fills the whole page instead of one panel. */
  page?: boolean;
  /** For the inside of a dialog: no card around it, and a Close button that shuts the dialog. */
  inline?: boolean;
  onClose?: () => void;
}

interface State {
  error: unknown;
  hasError: boolean;
}

/** Stops a crash in one screen from blanking the app, and says what to do next. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { error, hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    reportError(error);
    console.error(error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null, hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const d = describeError(this.state.error);
    return (
      <div
        role="alert"
        className={`flex flex-col items-start gap-3 ${
          this.props.page
            ? "mx-auto min-h-dvh max-w-md justify-center px-4 py-10"
            : this.props.inline
              ? "py-2"
              : "lv-card p-5"
        }`}
      >
        <h2 className="m-0 text-xl font-bold">{d.title}</h2>
        <p className="m-0 text-muted">{d.advice}</p>
        <div className="flex flex-wrap gap-2">
          {d.kind !== "session" && !this.props.page && (
            <Button onClick={() => this.setState({ error: null, hasError: false })}>
              Try again
            </Button>
          )}
          {this.props.inline && this.props.onClose && d.kind !== "session" && (
            <Button variant="ghost" onClick={this.props.onClose}>
              Close
            </Button>
          )}
          <Button
            variant={d.kind === "session" || this.props.page ? "primary" : "secondary"}
            onClick={() => window.location.reload()}
          >
            {d.kind === "session" ? "Sign in again" : "Reload the app"}
          </Button>
        </div>
      </div>
    );
  }
}
