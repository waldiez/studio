/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { useTheme } from "@/theme/hook";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
    const { toggle, theme } = useTheme();

    return (
        <button onClick={toggle} className="px-3 py-1.5 no-border clickable rounded text-sm">
            {theme === "dark" ? (
                <Sun className="h-[1.2rem] w-[1.2rem]" />
            ) : (
                <Moon className="h-[1.2rem] w-[1.2rem]" />
            )}
        </button>
    );
}
