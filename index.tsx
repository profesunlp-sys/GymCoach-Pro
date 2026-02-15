
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

// Global error listener to catch issues before React mounts
window.onerror = (message, source, lineno, colno, error) => {
  const root = document.getElementById('root');
  if (root && root.innerHTML === "") {
    root.innerHTML = `
      <div style="padding: 40px; font-family: sans-serif; text-align: center; color: #ef4444;">
        <h2 style="font-weight: 800;">Error de Carga</h2>
        <p style="color: #64748b;">${message}</p>
        <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #4f46e5; color: white; border: none; border-radius: 8px;">Reintentar</button>
      </div>
    `;
  }
};

const container = document.getElementById('root');
if (container) {
  try {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (err) {
    console.error("Mounting Error:", err);
  }
}
