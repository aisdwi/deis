import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import App from "./App";
import "./styles.css";

const legacyPages = {
  "dashboard.html": "/dashboard",
  "login.html": "/login",
  "register.html": "/register",
  "invitations.html": "/invitations",
};

if (!window.location.hash) {
  const file = window.location.pathname.split("/").pop();
  const params = new URLSearchParams(window.location.search);
  const pocketId = params.get("pocketId");
  let route = legacyPages[file] || "/";
  if (file === "family.html" && pocketId) route = `/family/${encodeURIComponent(pocketId)}`;
  if (file === "transactions.html" && pocketId) route = `/transactions/${encodeURIComponent(pocketId)}`;
  window.history.replaceState(null, "", `${window.location.pathname}#${route}`);
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>,
);
