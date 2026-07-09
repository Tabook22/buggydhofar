import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SiteContentProvider } from "./lib/siteContentContext";
import "./i18n";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <SiteContentProvider>
          <App />
        </SiteContentProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
