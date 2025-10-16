/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { useTheme } from "@/theme/hook";
import type * as monacoTypes from "monaco-editor";

import { useCallback, useRef } from "react";

import Editor, { type OnMount } from "@monaco-editor/react";

import { useEditorOptions } from "../hooks/useMonacoEditor";

export type CodeEditorProps = {
    value: string;
    onChange?: (next: string) => void;
    language?: string; // e.g. "python", "typescript", "markdown"...
    path?: string; // used to set model URI (helps Monaco features)
    readOnly?: boolean;
    onSave?: (value: string) => void;
    options?: monacoTypes.editor.IStandaloneEditorConstructionOptions;
    className?: string;
};

export default function CodeEditor({
    value,
    onChange,
    language = "plaintext",
    path = "inmemory://model.txt",
    readOnly = false,
    onSave,
    options,
    className,
}: CodeEditorProps) {
    const theme = useTheme().theme;
    const editorRef = useRef<monacoTypes.editor.IStandaloneCodeEditor | null>(null);
    const monacoRef = useRef<typeof monacoTypes | null>(null);

    const mergedOptions = useEditorOptions({
        readOnly,
        ...options,
    });

    const handleMount: OnMount = useCallback(
        (editor, monaco) => {
            editorRef.current = editor;
            monacoRef.current = monaco;

            // set up model with URI (better language services for some langs)
            try {
                const uri = monaco.Uri.parse(path.startsWith("inmemory://") ? path : `file://${path}`);
                let model = monaco.editor.getModel(uri);
                if (!model) {
                    model = monaco.editor.createModel(value, language, uri);
                } else {
                    model.setValue(value);
                    monaco.editor.setModelLanguage(model, language);
                }
                editor.setModel(model);
            } catch {
                // fallback: let @monaco-editor/react create the default model
            }

            // keybinding: Cmd/Ctrl+S => onSave
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                if (!onSave) {
                    return;
                }
                const v = editor.getValue();
                onSave(v);
            });

            // optional: format on mount if supported
            // editor.getAction("editor.action.formatDocument")?.run();
        },
        [language, onSave, path, value],
    );

    return (
        <div className={className ?? "h-full w-full"}>
            <Editor
                theme={theme === "dark" ? "vs-dark" : "vs"}
                defaultLanguage={language}
                defaultValue={value}
                value={value}
                onChange={v => onChange?.(v ?? "")}
                onMount={handleMount}
                options={mergedOptions}
                loading={<div className="p-3 text-sm opacity-70">Loading editor...</div>}
            />
        </div>
    );
}
