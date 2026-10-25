import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AtlasProvider } from './lib/store';
import { App } from './App';
import './styles/base.css';
import './styles/components.css';
import './styles/views.css';
import './styles/atlas.css';
import './styles/cabinet.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AtlasProvider>
      <App />
    </AtlasProvider>
  </StrictMode>,
);
