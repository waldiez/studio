/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { App } from "@/app/App";
import "@/index.css";

import React from "react";
import ReactDOM from "react-dom/client";

import "@waldiez/react/dist/@waldiez.css";

function initTheme() {
    // prefer existing, else dark
    const body = document.body;
    const hasLight = body.classList.contains("waldiez-light");
    const hasDark = body.classList.contains("waldiez-dark");
    const mode = hasLight ? "light" : hasDark ? "dark" : "dark";
    body.classList.toggle("waldiez-dark", mode === "dark");
    body.classList.toggle("waldiez-light", mode === "light");
    document.documentElement.classList.toggle("dark", mode === "dark");
    document.documentElement.classList.toggle("light", mode === "light");
}

export const startApp = () => {
    initTheme();
    ReactDOM.createRoot(document.getElementById("root")!).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>,
    );
};

startApp();
