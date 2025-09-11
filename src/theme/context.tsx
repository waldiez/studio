/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import type { Theme } from "@/types/theme";

import { createContext } from "react";

type ThemeProviderState = {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggle: () => void;
};

export const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined);
