import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/fonts.css';
import './index.css';
import App from './App.tsx';
import SpritePreview from './dev/SpritePreview.tsx';

const showSpritePreview = import.meta.env.DEV && new URLSearchParams(location.search).has('sprite');

createRoot(document.getElementById('root')!).render(
  <StrictMode>{showSpritePreview ? <SpritePreview /> : <App />}</StrictMode>,
);
