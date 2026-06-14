
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  // Service worker registration is handled by Vite PWA plugin (registerSW.js)
  // Do NOT register manually here as it causes conflicts

  createRoot(document.getElementById("root")!).render(<App />);
  