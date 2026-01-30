/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
/* eslint-disable max-statements */
import { App } from "@/app/App";
import "@/index.css";

import React from "react";
import ReactDOM from "react-dom/client";

import "@waldiez/react/dist/@waldiez.css";

/* c8 ignore next -- @preserve */
function initTheme(forceDarkInit: boolean = false) {
    if (typeof window === "undefined") {
        return;
    }
    const ls: any = window.localStorage as unknown;
    // prefer existing, else dark
    // Read from storage or use forced dark
    let mode: "light" | "dark" = "dark";
    if (!forceDarkInit) {
        const fromStorage =
            ls && typeof (ls as Storage).setItem === "function" ? ls.getItem("waldiez-theme") : "dark";
        if (fromStorage === "light") {
            mode = "light";
        }
    }

    if (ls && typeof (ls as Storage).setItem === "function") {
        try {
            // Persist choice
            ls.setItem("waldiez-theme", mode);
        } catch {
            // ignore storage failures (disabled, quota, privacy mode)
        }
    }
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
