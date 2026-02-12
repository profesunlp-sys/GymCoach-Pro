import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

if (rootElement) {
  try {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error("Error durante el renderizado de React:", error);
    rootElement.innerHTML = `
      <div style="padding: 2rem; color: #ef4444; font-family: sans-serif; text-align: center;">
        <h2 style="font-weight: 800;">Error de Inicialización</h2>
        <p style="color: #64748b;">${error instanceof Error ? error.message : 'Error desconocido'}</p>
        <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #1e1b4b; color: white; border-radius: 0.5rem; border: none; cursor: pointer;">
          Reintentar Carga
        </button>
      </div>
    `;
  }
} else {
  console.error("No se encontró el elemento #root en el DOM.");
}