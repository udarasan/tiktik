import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyTheme } from './lib/theme';
import { useUiStore } from './stores/ui';
import './index.css';

// Apply the saved theme before first paint (no inline script, so a strict CSP stays possible).
applyTheme(useUiStore.getState().theme);

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
