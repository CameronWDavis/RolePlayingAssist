import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createHashRouter } from 'react-router-dom';
import App from './App';
import { CharacterStoreProvider } from './components/CharacterStore';
import { DiceProvider } from './components/Dice';
import { HomebrewProvider } from './components/HomebrewStore';
import './styles.css';

// A hash router so the built site works on any static host without server rewrites.
// It's a "data router" so pages can warn before you navigate away from unsaved work (useBlocker).
// App keeps its own <Routes>, so everything goes through one catch-all route.
const router = createHashRouter([{ path: '*', element: <App /> }]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DiceProvider>
      <HomebrewProvider>
        <CharacterStoreProvider>
          <RouterProvider router={router} />
        </CharacterStoreProvider>
      </HomebrewProvider>
    </DiceProvider>
  </StrictMode>,
);
