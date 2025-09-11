/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import CodeEditor from "@/features/editor/components/CodeEditor";
import MarkdownViewer from "@/features/viewers/components/MarkdownViewer";
import MediaViewer from "@/features/viewers/components/MediaViewer";
import MermaidViewer from "@/features/viewers/components/MermaidViewer";
import NotebookViewer from "@/features/viewers/components/NotebookViewer";
import SQLiteViewer from "@/features/viewers/components/SQLiteViewer";
import WaldiezViewer from "@/features/viewers/components/WaldiezViewer";
import { routeFile } from "@/lib/fileTypes";
import { extOf } from "@/utils/paths";

const SQLITE_EXTS = new Set([".db", ".sqlite", ".sqlite3"]);

type TextData = { kind: "text"; content: string };
type BinaryData = { kind: "binary"; mime: string; url: string };

export type ViewerRouterProps = {
    /** File name (used for language guessing & model URI) */
    name: string;
    /** Optional MIME from backend */
    mime?: string;
    /** Text or Binary payload */
    data: TextData | BinaryData;
    /** Called when code/text changes (for editors); optional for read-only viewers */
    onChangeText?: (next: string) => void;
    /** Optional save handler for editors (Cmd/Ctrl+S) */
    onSaveText?: (value: string) => void;
    /** Absolute or workspace-relative path for Monaco model URI */
    path?: string;
};

export default function ViewerRouter({
    name,
    mime,
    data,
    onChangeText,
    onSaveText,
    path,
}: ViewerRouterProps) {
    const route = routeFile(name);

    if (data.kind === "text") {
        if (route.kind === "code") {
            if (route.language === "waldiez") {
                return <WaldiezViewer source={data.content} />;
            }
            return (
                <CodeEditor
                    value={data.content}
                    onChange={onChangeText}
                    onSave={onSaveText}
                    language={route.language ?? "plaintext"}
                    path={path ?? `/${name}`}
                    className="h-full w-full"
                />
            );
        }
        if (route.kind === "markdown") {
            return <MarkdownViewer source={data.content} />;
        }
        if (route.kind === "mermaid") {
            return <MermaidViewer source={data.content} className="h-full w-full" />;
        }
        if (route.kind === "notebook") {
            try {
                return <NotebookViewer note={JSON.parse(data.content)} />;
            } catch {
                return <div className="p-4 text-sm text-red-500">Invalid .ipynb (JSON parse failed)</div>;
            }
        }
        // default text viewer: code editor as plaintext
        return (
            <CodeEditor
                value={data.content}
                onChange={onChangeText}
                onSave={onSaveText}
                language="plaintext"
                path={path ?? `/${name}`}
                className="h-full w-full"
            />
        );
    }
    if (data.kind === "binary") {
        if (mime?.startsWith("image/") || mime?.startsWith("video/") || mime?.startsWith("audio/")) {
            return <MediaViewer url={data.url} mime={data.mime} className="h-full w-full" />;
        }
        if (path) {
            const ext = extOf(data.url);
            if (SQLITE_EXTS.has(ext)) {
                return <SQLiteViewer path={path} />;
            }
        }
        return (
            <div className="p-4 text-sm opacity-70">
                Binary file ({data.mime}).
                <a className="underline" href={data.url} download>
                    Download
                </a>
            </div>
        );
    }

    return <div className="p-4 text-sm opacity-70">Nothing to display.</div>;
}
