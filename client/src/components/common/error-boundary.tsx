import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Catches render-time crashes so one broken subtree cannot blank the app.
 *
 * React unmounts the entire tree when a render throws and nothing catches it —
 * the user is left with a white page and no way back. Error boundaries are still
 * the only mechanism for this; there is no hook equivalent, which is why this is
 * the codebase's one class component.
 *
 * `resetKey` is what makes recovery possible: change it (the router passes the
 * pathname) and the boundary clears its error, so navigating away from a broken
 * page works without a full reload.
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  /** Receives the error and a callback that clears it. */
  fallback: (error: Error, reset: () => void) => ReactNode;
  /** Changing this value clears a caught error. */
  resetKey?: unknown;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
  /** Snapshot of `resetKey` taken when the error was caught. */
  keyAtError: unknown;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null, keyAtError: undefined };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    if (!state.error) return { keyAtError: props.resetKey };
    // Comparing against the key captured at throw time, rather than the previous
    // render's key, is what stops the boundary from clearing itself on the very
    // render that caught the error.
    return props.resetKey === state.keyAtError ? null : { error: null, keyAtError: props.resetKey };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
    // Kept deliberately: without it a caught error leaves no trace in the
    // console, and the component stack is the only pointer to where it came from.
    console.error('Unhandled render error', error, info.componentStack);
  }

  private readonly reset = () => this.setState({ error: null, keyAtError: undefined });

  override render(): ReactNode {
    const { error } = this.state;
    return error ? this.props.fallback(error, this.reset) : this.props.children;
  }
}
