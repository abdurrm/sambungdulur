import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { installThemeCss } from './theme/tokens';
import { initialLang, loadLang } from './i18n';

installThemeCss();

document.documentElement.dataset.theme = 'light';

// The strings of the chosen language arrive before the first render (English is built in).
void loadLang(initialLang())
  .catch(() => undefined)
  .finally(() =>
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  );

// Offline support: the service worker precaches the built app (see scripts/build-sw.mjs).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* offline support unavailable (e.g. insecure context); the app still works online */
    });
  });
}
