import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Apply stored theme class on initial load
const storedTheme = localStorage.getItem("sysops-theme") ?? "dark";
document.documentElement.classList.toggle("dark", storedTheme === "dark");
document.documentElement.classList.toggle("light", storedTheme === "light");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
