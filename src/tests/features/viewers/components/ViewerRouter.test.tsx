/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
import ViewerRouter from "@/features/viewers/components/ViewerRouter";
import { routeFile } from "@/lib/fileTypes";
import { extOf } from "@/utils/paths";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock all the viewer components
vi.mock("@/features/editor/components/CodeEditor", () => ({
    default: ({ value, language, path }: any) => (
        <div data-testid="code-editor">
            <div data-testid="code-value">{value}</div>
            <div data-testid="code-language">{language}</div>
            <div data-testid="code-path">{path}</div>
        </div>
    ),
}));

vi.mock("@/features/viewers/components/MarkdownViewer", () => ({
    default: ({ source }: any) => <div data-testid="markdown-viewer">{source}</div>,
}));

vi.mock("@/features/viewers/components/MediaViewer", () => ({
    default: ({ url, mime }: any) => (
        <div data-testid="media-viewer">
            <div data-testid="media-url">{url}</div>
            <div data-testid="media-mime">{mime}</div>
        </div>
    ),
}));

vi.mock("@/features/viewers/components/MermaidViewer", () => ({
    default: ({ source }: any) => <div data-testid="mermaid-viewer">{source}</div>,
}));

vi.mock("@/features/viewers/components/NotebookViewer", () => ({
    default: ({ note }: any) => <div data-testid="notebook-viewer">{JSON.stringify(note)}</div>,
}));

vi.mock("@/features/viewers/components/SQLiteViewer", () => ({
    default: ({ path }: any) => <div data-testid="sqlite-viewer">{path}</div>,
}));

vi.mock("@/features/viewers/components/WaldiezViewer", () => ({
    default: ({ source }: any) => <div data-testid="waldiez-viewer">{source}</div>,
}));

vi.mock("@/features/viewers/components/PdfViewer", () => ({
    default: ({ source }: any) => <div data-testid="pdf-viewer">{source}</div>,
}));

vi.mock("@/lib/fileTypes", () => ({
    routeFile: vi.fn(),
}));

vi.mock("@/utils/paths", () => ({
    extOf: vi.fn(),
}));

describe("ViewerRouter", () => {
    const mockRouteFile = routeFile as ReturnType<typeof vi.fn>;
    const mockExtOf = extOf as ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("text content routing", () => {
        it("renders CodeEditor for code files", () => {
            mockRouteFile.mockReturnValue({ kind: "code", language: "python" });

            render(
                <ViewerRouter
                    name="script.py"
                    data={{ kind: "text", content: "print('hello')" }}
                    path="/test/script.py"
                />,
            );

            expect(screen.getByTestId("code-editor")).toBeInTheDocument();
            expect(screen.getByTestId("code-value")).toHaveTextContent("print('hello')");
            expect(screen.getByTestId("code-language")).toHaveTextContent("python");
            expect(screen.getByTestId("code-path")).toHaveTextContent("/test/script.py");
        });

        it("renders WaldiezViewer for Waldiez files", () => {
            mockRouteFile.mockReturnValue({ kind: "code", language: "waldiez" });

            render(<ViewerRouter name="flow.waldiez" data={{ kind: "text", content: "flow content" }} />);

            expect(screen.getByTestId("waldiez-viewer")).toBeInTheDocument();
            expect(screen.getByTestId("waldiez-viewer")).toHaveTextContent("flow content");
        });

        it("renders MarkdownViewer for markdown files", () => {
            mockRouteFile.mockReturnValue({ kind: "markdown" });

            render(<ViewerRouter name="README.md" data={{ kind: "text", content: "# Hello World" }} />);

            expect(screen.getByTestId("markdown-viewer")).toBeInTheDocument();
            expect(screen.getByTestId("markdown-viewer")).toHaveTextContent("# Hello World");
        });

        it("renders MermaidViewer for mermaid files", () => {
            mockRouteFile.mockReturnValue({ kind: "mermaid" });

            render(<ViewerRouter name="diagram.mmd" data={{ kind: "text", content: "graph TD; A-->B;" }} />);

            expect(screen.getByTestId("mermaid-viewer")).toBeInTheDocument();
            expect(screen.getByTestId("mermaid-viewer")).toHaveTextContent("graph TD; A-->B;");
        });

        it("renders NotebookViewer for valid notebook files", () => {
            mockRouteFile.mockReturnValue({ kind: "notebook" });

            const notebookContent = JSON.stringify({ cells: [] });

            render(<ViewerRouter name="notebook.ipynb" data={{ kind: "text", content: notebookContent }} />);

            expect(screen.getByTestId("notebook-viewer")).toBeInTheDocument();
        });

        it("shows error for invalid notebook JSON", () => {
            mockRouteFile.mockReturnValue({ kind: "notebook" });

            render(<ViewerRouter name="notebook.ipynb" data={{ kind: "text", content: "invalid json" }} />);

            expect(screen.getByText("Invalid .ipynb (JSON parse failed)")).toBeInTheDocument();
        });

        it("renders CodeEditor as fallback for unknown text types", () => {
            mockRouteFile.mockReturnValue({ kind: "unknown" });

            render(
                <ViewerRouter
                    name="unknown.txt"
                    data={{ kind: "text", content: "some content" }}
                    path="/unknown.txt"
                />,
            );

            expect(screen.getByTestId("code-editor")).toBeInTheDocument();
            expect(screen.getByTestId("code-language")).toHaveTextContent("plaintext");
        });

        it("handles code files without language", () => {
            mockRouteFile.mockReturnValue({ kind: "code" });

            render(<ViewerRouter name="file.txt" data={{ kind: "text", content: "content" }} />);

            expect(screen.getByTestId("code-editor")).toBeInTheDocument();
            expect(screen.getByTestId("code-language")).toHaveTextContent("plaintext");
        });

        it("uses default path when not provided", () => {
            mockRouteFile.mockReturnValue({ kind: "code", language: "python" });

            render(<ViewerRouter name="script.py" data={{ kind: "text", content: "print('hello')" }} />);

            expect(screen.getByTestId("code-path")).toHaveTextContent("/script.py");
        });
    });

    describe("binary content routing", () => {
        it("renders MediaViewer for image files", () => {
            render(
                <ViewerRouter
                    name="image.png"
                    mime="image/png"
                    data={{ kind: "binary", mime: "image/png", url: "http://example.com/image.png" }}
                />,
            );

            expect(screen.getByTestId("media-viewer")).toBeInTheDocument();
            expect(screen.getByTestId("media-url")).toHaveTextContent("http://example.com/image.png");
            expect(screen.getByTestId("media-mime")).toHaveTextContent("image/png");
        });

        it("renders MediaViewer for video files", () => {
            render(
                <ViewerRouter
                    name="video.mp4"
                    mime="video/mp4"
                    data={{ kind: "binary", mime: "video/mp4", url: "http://example.com/video.mp4" }}
                />,
            );

            expect(screen.getByTestId("media-viewer")).toBeInTheDocument();
        });

        it("renders MediaViewer for audio files", () => {
            render(
                <ViewerRouter
                    name="audio.mp3"
                    mime="audio/mpeg"
                    data={{ kind: "binary", mime: "audio/mpeg", url: "http://example.com/audio.mp3" }}
                />,
            );

            expect(screen.getByTestId("media-viewer")).toBeInTheDocument();
        });

        it("renders SQLiteViewer for SQLite files", () => {
            mockExtOf.mockReturnValue(".db");

            render(
                <ViewerRouter
                    name="database.db"
                    data={{ kind: "binary", mime: "application/octet-stream", url: "file.db" }}
                    path="/test/database.db"
                />,
            );

            expect(screen.getByTestId("sqlite-viewer")).toBeInTheDocument();
            expect(screen.getByTestId("sqlite-viewer")).toHaveTextContent("/test/database.db");
        });

        it("renders download link for unknown binary files", () => {
            render(
                <ViewerRouter
                    name="file.bin"
                    data={{ kind: "binary", mime: "application/octet-stream", url: "file.bin" }}
                />,
            );

            expect(screen.getByText("Binary file (application/octet-stream).")).toBeInTheDocument();
            expect(screen.getByText("Download")).toBeInTheDocument();

            const downloadLink = screen.getByText("Download").closest("a");
            expect(downloadLink).toHaveAttribute("href", "file.bin");
            expect(downloadLink).toHaveAttribute("download");
        });

        it("handles SQLite extensions correctly", () => {
            mockExtOf.mockReturnValue(".sqlite3");

            render(
                <ViewerRouter
                    name="database.sqlite3"
                    data={{ kind: "binary", mime: "application/octet-stream", url: "file.sqlite3" }}
                    path="/test/database.sqlite3"
                />,
            );

            expect(screen.getByTestId("sqlite-viewer")).toBeInTheDocument();
        });

        it("does not render SQLiteViewer without path", () => {
            mockExtOf.mockReturnValue(".db");

            render(
                <ViewerRouter
                    name="database.db"
                    data={{ kind: "binary", mime: "application/octet-stream", url: "file.db" }}
                />,
            );

            expect(screen.queryByTestId("sqlite-viewer")).not.toBeInTheDocument();
            expect(screen.getByText("Download")).toBeInTheDocument();
        });
    });

    describe("edge cases", () => {
        it("renders fallback for unknown data kind", () => {
            render(<ViewerRouter name="unknown" data={{} as any} />);

            expect(screen.getByText("Nothing to display.")).toBeInTheDocument();
        });

        it("handles missing mime type for binary files", () => {
            render(
                <ViewerRouter name="file.bin" data={{ kind: "binary", mime: "unknown", url: "file.bin" }} />,
            );

            expect(screen.getByText("Binary file (unknown).")).toBeInTheDocument();
        });

        it("passes callbacks to CodeEditor", () => {
            mockRouteFile.mockReturnValue({ kind: "code", language: "python" });

            const onChangeText = vi.fn();
            const onSaveText = vi.fn();

            render(
                <ViewerRouter
                    name="script.py"
                    data={{ kind: "text", content: "print('hello')" }}
                    onChangeText={onChangeText}
                    onSaveText={onSaveText}
                />,
            );

            expect(screen.getByTestId("code-editor")).toBeInTheDocument();
            // Callbacks would be tested in CodeEditor component tests
        });

        it("handles empty content", () => {
            mockRouteFile.mockReturnValue({ kind: "code", language: "python" });

            render(<ViewerRouter name="script.py" data={{ kind: "text", content: "" }} />);

            expect(screen.getByTestId("code-editor")).toBeInTheDocument();
            expect(screen.getByTestId("code-value")).toHaveTextContent("");
        });
    });
});
