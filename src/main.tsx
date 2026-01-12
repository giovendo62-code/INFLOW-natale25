import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { GlobalErrorBoundary } from './components/GlobalErrorBoundary'
import './index.css'
import './styles/theme.css'

// Global Error Handlers
window.onerror = (message, source, lineno, colno, error) => {
  console.error('[MOBILE-BLACKSCREEN] Global error:', { message, source, lineno, colno, error });
  alert(`Errore Critico: ${message}\nIn: ${source}:${lineno}`);
};

window.onunhandledrejection = (event) => {
  console.error('[MOBILE-BLACKSCREEN] Unhandled rejection:', event.reason);
};

console.log('App starting...');

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes fresh
      gcTime: 1000 * 60 * 10, // 10 minutes cache
      retry: 1,
      refetchOnWindowFocus: false, // Better for mobile
    },
  },
});

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <GlobalErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </GlobalErrorBoundary>
    </React.StrictMode>
  );
}
