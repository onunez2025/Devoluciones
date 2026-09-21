import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n';
import { ThemeProvider } from './context/ThemeContext';
import { AppConfigProvider } from './context/AppConfigContext';
import { Capacitor } from '@capacitor/core';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppConfigProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </AppConfigProvider>
  </React.StrictMode>
);

/**
 * Service worker: lo que hace que Chrome ofrezca «Instalar» en la web. Se registra después de `load` para no competir
 * con la carga de la aplicación, y solo en producción.
 *
 * **Nunca dentro de la app Android.** Devoluciones también se empaqueta con Capacitor, y ahí el contenido no viene de
 * la red sino del propio APK: un worker que intenta ir a la red antes de servir la página dejaría la app nativa
 * mostrando la pantalla de «sin conexión». `isNativePlatform()` distingue los dos casos.
 *
 * `updateViaCache: 'none'` obliga al navegador a pedir el propio `sw.js` a la red en cada comprobación, que es como se
 * entera de que hay una versión nueva tras un despliegue.
 */
if ('serviceWorker' in navigator && import.meta.env.PROD && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .catch(err => console.warn('[PWA] No se pudo registrar el service worker:', err));
  });
}
