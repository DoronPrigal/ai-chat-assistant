import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Error Boundary: אם רכיב קורס בזמן ציור המסך, מציגים הודעה ידידותית במקום מסך ריק.
// ב-React זה חייב להיות רכיב מסוג class (אין לזה Hook).
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("The app crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="crash">
        <div className="crash-card" role="alert">
          <h1>Something went wrong</h1>
          <p>An unexpected error stopped the page. Your conversations are saved – reloading usually fixes it.</p>
          <button type="button" className="button-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </main>
    );
  }
}
