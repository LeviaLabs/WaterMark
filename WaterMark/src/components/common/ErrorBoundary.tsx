import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Names the part that failed, so the fallback says what could not be shown. */
  label?: string
}

interface State {
  error: Error | null
  resetKey: number
}

/**
 * Catches a render error in the routes or the map report and shows a retry,
 * instead of unmounting the whole page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: 0 }

  static getDerivedStateFromError(error: Error): Pick<State, 'error'> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    void error
    void info.componentStack
  }

  private reset = () => {
    this.setState((state) => ({ error: null, resetKey: state.resetKey + 1 }))
  }

  render() {
    if (this.state.error) {
      return (
        <section className="error-fallback" role="alert">
          <p><strong>{this.props.label ?? 'This view'} hit a problem and could not be shown.</strong></p>
          <p>That is not an all-clear. The rest of WaterMark is still available.</p>
          <button type="button" className="error-fallback-retry" onClick={this.reset}>Try again</button>
        </section>
      )
    }
    return <div key={this.state.resetKey} className="error-boundary-slot">{this.props.children}</div>
  }
}
