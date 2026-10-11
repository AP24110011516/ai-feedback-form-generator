import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

import React from 'react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('App crash:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          fontFamily: 'monospace', padding: '2rem', background: '#1e1e2e',
          color: '#f38ba8', minHeight: '100vh', whiteSpace: 'pre-wrap'
        }}>
          <h2 style={{ color: '#cba6f7' }}>⚠️ App Error</h2>
          <p>{this.state.error?.message}</p>
          <pre style={{ fontSize: '0.8rem', color: '#a6e3a1', marginTop: '1rem' }}>
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
