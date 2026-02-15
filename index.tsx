
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
    console.error("Critical Runtime Error:", error);
    rootElement.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 2rem; background: #020617; color: white; font-family: sans-serif; text-align: center;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
        <h2 style="font-size: 1.5rem; font-weight: 800; margin-bottom: 0.5rem;">Error de Aplicación</h2>
        <p style="color: #94a3b8; max-width: 400px; margin-bottom: 2rem;">
          Hubo un problema al iniciar GymCoach Pro Elite. Por favor, revisa la conexión o el estado de los servicios.
        </p>
        <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 1rem; font-family: monospace; font-size: 0.8rem; margin-bottom: 2rem; color: #f87171;">
          ${error instanceof Error ? error.message : 'Unknown error during bootstrap'}
        </div>
        <button onclick="location.reload()" style="padding: 1rem 2rem; background: #4f46e5; color: white; border-radius: 3rem; border: none; font-weight: 700; cursor: pointer; transition: all 0.2s;">
          REINTENTAR ACCESO
        </button>
      </div>
    `;
  }
}
