import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { BoardProvider } from './state/BoardProvider';
import './styles/fonts';
import './styles/tokens.css';
import './styles/base.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BoardProvider>
      <App />
    </BoardProvider>
  </StrictMode>,
);
