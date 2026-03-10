import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import MesaReceptora from './MesaReceptora.tsx';
import './index.css';

// Roteamento simples: /mesa -> Mesa Receptora, / -> Urna
const isMesa = window.location.pathname.includes('/mesa');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isMesa ? <MesaReceptora /> : <App />}
  </StrictMode>,
);
