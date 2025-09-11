/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { ThemeProviderContext } from "@/theme/context";
import type { Theme } from "@/types/theme";

import { useCallback, useEffect, useState } from "react";

type ThemeProviderProps = {
    children: React.ReactNode;
    defaultTheme?: Theme;
    storageKey?: string;
};

const getDefaultInitialTheme = (storageKey: string, defaultTheme: Theme | undefined) => {
    try {
        const fromStorage = localStorage.getItem(storageKey);
        if (fromStorage === "light" || fromStorage === "dark" || fromStorage === "system") {
            return fromStorage as Theme;
        }
    } catch {
        //
    }
    return defaultTheme || "system";
};

export function ThemeProvider({
    children,
    defaultTheme,
    storageKey = "waldiez-ui-theme",
    ...props
}: ThemeProviderProps) {
    const [theme, setTheme] = useState<Theme>(getDefaultInitialTheme(storageKey, defaultTheme));

    useEffect(() => {
        const root = window.document.documentElement;

        root.classList.remove("light", "dark");

        if (theme === "system") {
            const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

            root.classList.add(systemTheme);
            return;
        }

        root.classList.add(theme);
    }, [theme]);

    const updateTheme = useCallback(
        (newTheme: Theme) => {
            try {
                localStorage.setItem(storageKey, newTheme);
            } catch {
                //
            }
            setTheme(newTheme);
            document.body.classList.toggle("waldiez-dark", newTheme === "dark");
            document.body.classList.toggle("waldiez-light", newTheme === "light");
            document.documentElement.classList.toggle("dark", newTheme === "dark");
            document.documentElement.classList.toggle("light", newTheme === "light");
        },
        [storageKey],
    );

    const value = {
        theme,
        setTheme: updateTheme,
        toggle: useCallback(() => {
            const newTheme = theme === "light" ? "dark" : "light";
            updateTheme(newTheme);
        }, [theme, updateTheme]),
    };
    return (
        <ThemeProviderContext.Provider {...props} value={value}>
            {children}
        </ThemeProviderContext.Provider>
    );
}
