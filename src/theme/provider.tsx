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
    storageKey = "waldiez-theme",
    ...props
}: ThemeProviderProps) {
    const [theme, setTheme] = useState<Theme>(getDefaultInitialTheme(storageKey, defaultTheme));

    const updateTheme = useCallback(
        (newTheme: Theme) => {
            try {
                localStorage.setItem(storageKey, newTheme);
            } catch {
                //
            }
            setTheme(newTheme);
            document.body.classList.remove("waldiez-dark", "waldiez-light");
            document.body.classList.add(`waldiez-${newTheme}`);
            document.documentElement.classList.remove("dark", "light");
            document.documentElement.classList.add(newTheme);
        },
        [storageKey],
    );
    useEffect(() => {
        const root = window.document.documentElement;

        root.classList.remove("light", "dark");

        if (theme === "system") {
            const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

            root.classList.add(systemTheme);
            return;
        }

        root.classList.add(theme);
        // Observer to detect external theme changes
        /* c8 ignore next -- @preserve */
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.type === "attributes" && mutation.attributeName === "class") {
                    const bodyClassList = document.body.classList;
                    const externalIsDark =
                        bodyClassList.contains("waldiez-dark") ||
                        bodyClassList.contains("dark-theme") ||
                        (!bodyClassList.contains("waldiez-light") && !bodyClassList.contains("light-theme"));

                    // Only update if there's a mismatch
                    setTheme(prev => {
                        if (externalIsDark && prev !== "dark") {
                            return "dark";
                        }
                        if (!externalIsDark && prev !== "light") {
                            return "light";
                        }
                        return prev;
                    });
                }
            });
        });

        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ["class"],
        });

        return () => observer.disconnect();
    }, [theme]);

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
