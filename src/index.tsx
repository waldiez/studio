/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { App } from "@/app/App";
import "@/index.css";

import React from "react";
import ReactDOM from "react-dom/client";

import "@waldiez/react/dist/@waldiez.css";

function initTheme(forceDarkInit: boolean = false) {
    // prefer existing, else dark
    // Read from storage or use forced dark
    let mode: "light" | "dark" = "dark";
    if (!forceDarkInit) {
        const fromStorage = localStorage.getItem("waldiez-them");
        if (fromStorage === "light") {
            mode = "light";
        }
    }
    // Persist choice
    localStorage.setItem("waldiez-theme", mode);
    const body = document.body;
    // Remove any stale waldiez-* classes
    body.classList.remove("waldiez-light", "waldiez-dark");
    // Apply the correct one
    body.classList.add(`waldiez-${mode}`);
    // Mirror to <html> for Tailwind/dark-mode usage
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(mode);
}

export const startApp = () => {
    initTheme(true);
    ReactDOM.createRoot(document.getElementById("root")!).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>,
    );
};

startApp();
