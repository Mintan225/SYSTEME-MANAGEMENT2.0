
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element not found");
}

try {
  const root = createRoot(container);
  root.render(<App />);
} catch (error) {
  console.error("Failed to render React app:", error);
  
  // Fallback error display
  container.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background: #f8f9fa;
      color: #333;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      text-align: center;
      padding: 20px;
    ">
      <h1 style="color: #dc3545; margin-bottom: 16px;">Erreur de l'application</h1>
      <p style="margin-bottom: 20px;">Une erreur s'est produite lors du chargement de l'application.</p>
      <p style="font-size: 14px; color: #666; margin-bottom: 20px;">Détails: ${error.message}</p>
      <button 
        onclick="window.location.reload()" 
        style="
          background: #007bff;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
        "
      >
        Recharger la page
      </button>
    </div>
  `;
}
