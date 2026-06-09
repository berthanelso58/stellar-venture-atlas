import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

// Allow pointing the frontend at a different API origin (useful for production deploys
// where frontend and backend are on separate domains/ports, or when using the built
// static files served from a CDN). Set VITE_API_BASE_URL at build or dev time.
// Example: VITE_API_BASE_URL=https://api.example.com
const apiBase = import.meta.env.VITE_API_BASE_URL;
if (apiBase) {
  setBaseUrl(apiBase);
}

createRoot(document.getElementById("root")!).render(<App />);
