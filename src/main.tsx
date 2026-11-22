import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { CharacterStoreProvider } from './components/CharacterStore';
import { DiceProvider } from './components/Dice';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* HashRouter so the built site works on any static host without server rewrites. */}
    <HashRouter>
      <DiceProvider>
        <CharacterStoreProvider>
          <App />
        </CharacterStoreProvider>
      </DiceProvider>
    </HashRouter>
  </StrictMode>,
);
