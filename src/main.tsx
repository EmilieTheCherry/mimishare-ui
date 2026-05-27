import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./main.css";
import { AppContextProvider } from "./context/AppContext.tsx";
import { StreamSettingsContextProvider } from "./context/StreamSettingsContext.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StreamSettingsContextProvider>
      <AppContextProvider>
        <App />
      </AppContextProvider>
    </StreamSettingsContextProvider>
  </StrictMode>,
);
