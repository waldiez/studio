/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { useMemo } from "react";

/**
 * Merge base editor options with sensible defaults.
 */
export function useEditorOptions(
    overrides?: import("monaco-editor").editor.IStandaloneEditorConstructionOptions,
) {
    return useMemo(
        () => ({
            fontSize: 13,
            fontLigatures: true,
            minimap: { enabled: false },
            automaticLayout: true,
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            renderWhitespace: "selection" as const,
            wordWrap: "on" as const,
            tabSize: 4,
            cursorBlinking: "smooth" as const,
            ...overrides,
        }),
        [overrides],
    );
}
