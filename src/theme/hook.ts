/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
import { ThemeProviderContext } from "@/theme/context";

import { useContext } from "react";

export const useTheme = () => {
    const context = useContext(ThemeProviderContext);

    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }

    return context;
};
