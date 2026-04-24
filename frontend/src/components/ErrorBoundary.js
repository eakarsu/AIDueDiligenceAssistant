import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '400px', padding: '40px',
          textAlign: 'center',
        }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '20px',
            background: 'rgba(239, 68, 68, 0.15)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: '36px',
            marginBottom: '20px',
          }}>!</div>
          <h2 style={{ color: '#fff', fontSize: '22px', marginBottom: '10px' }}>Something went wrong</h2>
          <p style={{ color: '#a1a1aa', fontSize: '14px', marginBottom: '24px', maxWidth: '400px' }}>
            An unexpected error occurred. Please try refreshing the page.
          </p>
          <p style={{ color: '#71717a', fontSize: '12px', marginBottom: '20px', fontFamily: 'monospace' }}>
            {this.state.error?.message}
          </p>
          <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }} style={{
            padding: '12px 24px', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
            border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px',
            fontWeight: '600', cursor: 'pointer',
          }}>Reload Page</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
