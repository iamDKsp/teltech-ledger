import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Registrar Service Worker para PWA / instalação mobile
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
