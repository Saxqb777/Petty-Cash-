import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-paper-100 flex items-center justify-center p-4">
          <div className="plate w-full max-w-md">
            <div className="flex items-center gap-3 bg-flare-500 border-b-2 border-ink-900 px-5 py-3">
              <AlertTriangle className="w-5 h-5 text-ink-900 flex-shrink-0" strokeWidth={2.25} />
              <span className="font-mono text-2xs uppercase text-ink-900">Entry void</span>
            </div>

            <div className="p-6">
              <h2 className="text-2xl font-extrabold w-wider text-ink-900 mb-2">This page did not balance</h2>
              <p className="text-sm text-ink-500 leading-relaxed mb-4">
                Something failed while rendering. Nothing you entered was charged to anything.
              </p>

              <pre className="bg-paper-100 border border-paper-400 p-3 mb-6 font-mono text-xs text-ink-600 whitespace-pre-wrap break-words">
                {this.state.error.message || 'Unknown error'}
              </pre>

              <button
                className="btn-primary w-full"
                onClick={() => { this.setState({ error: null }); window.location.href = '/'; }}
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
