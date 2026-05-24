import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initFrontendSentry } from '@/lib/sentry';
import App from './App.tsx';
import './index.css';

initFrontendSentry();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
