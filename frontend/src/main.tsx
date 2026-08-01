import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { reportWebVitals } from './lib/vitals';
import { initAnalytics } from './lib/analytics';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

reportWebVitals();
initAnalytics();
