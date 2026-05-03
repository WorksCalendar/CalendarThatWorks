import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string | null }

export default class DemoErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: null };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : 'Unknown error' };
  }

  handleReset = (): void => {
    this.setState({ hasError: false, message: null });
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 640, margin: '10vh auto' }}>
        <h1>Demo failed to render</h1>
        <p>{this.state.message ?? 'A render error occurred.'}</p>
        <button type="button" onClick={this.handleReset}>Reload demo</button>
      </div>
    );
  }
}
