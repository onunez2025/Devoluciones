import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ThemeProvider } from './context/ThemeContext';
import { AppConfigProvider } from './context/AppConfigContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppConfigProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </AppConfigProvider>
  </React.StrictMode>
);
