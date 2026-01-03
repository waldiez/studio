/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
/* eslint-disable max-statements, complexity */
import { useWorkspace } from "@/store/workspace";

import { useEffect } from "react";

/**
 * Hook to handle keyboard shortcuts for tab navigation
 * - Cmd/Ctrl + W or Alt + W: Close active tab
 * - Cmd/Ctrl + 1-9: Switch to tab by index
 * - Alt/Option + 1-9: Switch to tab by index
 * - Alt/Option + ←/→: Navigate between tabs
 * - Cmd/Ctrl + Shift + [ or ]: Navigate between tabs (alternative)
 */
export default function KeyboardListener() {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const { openTabs, activeTabId, closeTab, setActiveTab } = useWorkspace.getState();
            const isMod = e.metaKey || e.ctrlKey;

            // Cmd/Ctrl + W or Alt + W: Close active tab
            if ((isMod || e.altKey) && e.code === "KeyW" && !(isMod && e.altKey)) {
                if (activeTabId && openTabs.length > 0) {
                    e.preventDefault();
                    closeTab(activeTabId);
                }
                return;
            }

            // Cmd/Ctrl + 1-9: Switch to tab by index
            if (isMod && !e.altKey && e.code >= "Digit1" && e.code <= "Digit9") {
                e.preventDefault();
                const index = parseInt(e.code.replace("Digit", "")) - 1;
                if (index < openTabs.length) {
                    setActiveTab(openTabs[index].id);
                }
                return;
            }

            // Alt/Option + 1-9: Switch to tab by index
            if (e.altKey && !e.metaKey && !e.ctrlKey && e.code >= "Digit1" && e.code <= "Digit9") {
                e.preventDefault();
                const index = parseInt(e.code.replace("Digit", "")) - 1;
                if (index < openTabs.length) {
                    setActiveTab(openTabs[index].id);
                }
                return;
            }

            // Alt/Option + ←/→: Navigate between tabs
            if (e.altKey && !e.metaKey && !e.ctrlKey && (e.code === "ArrowLeft" || e.code === "ArrowRight")) {
                e.preventDefault();
                const currentIndex = openTabs.findIndex(t => t.id === activeTabId);
                if (currentIndex !== -1 && openTabs.length > 1) {
                    let newIndex: number;
                    if (e.code === "ArrowRight") {
                        newIndex = (currentIndex + 1) % openTabs.length;
                    } else {
                        newIndex = currentIndex === 0 ? openTabs.length - 1 : currentIndex - 1;
                    }
                    setActiveTab(openTabs[newIndex].id);
                }
                return;
            }

            // Cmd/Ctrl + Shift + [ or ]: Navigate tabs (alternative)
            if (isMod && e.shiftKey && (e.code === "BracketLeft" || e.code === "BracketRight")) {
                e.preventDefault();
                const currentIndex = openTabs.findIndex(t => t.id === activeTabId);
                if (currentIndex !== -1 && openTabs.length > 1) {
                    let newIndex: number;
                    if (e.code === "BracketRight") {
                        newIndex = (currentIndex + 1) % openTabs.length;
                    } else {
                        newIndex = currentIndex === 0 ? openTabs.length - 1 : currentIndex - 1;
                    }
                    setActiveTab(openTabs[newIndex].id);
                }
                return;
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        // Return cleanup function
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    return null;
}
