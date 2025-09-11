/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import CodeEditor from "@/features/editor/components/CodeEditor";
import { useEditorOptions } from "@/features/editor/hooks/useMonacoEditor";
import { useTheme } from "@/theme/hook";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Monaco Editor
const mockEditor = {
    getValue: vi.fn(),
    setValue: vi.fn(),
    setModel: vi.fn(),
    addCommand: vi.fn(),
    getAction: vi.fn(),
};

const mockModel = {
    setValue: vi.fn(),
};

const mockMonaco = {
    Uri: {
        parse: vi.fn().mockReturnValue("mock-uri"),
    },
    KeyMod: {
        CtrlCmd: 2048,
    },
    KeyCode: {
        KeyS: 49,
    },
    editor: {
        getModel: vi.fn(),
        createModel: vi.fn().mockReturnValue(mockModel),
        setModelLanguage: vi.fn(),
    },
};

vi.mock("@monaco-editor/react", () => ({
    default: ({ onMount, onChange, theme, loading, defaultLanguage, ...props }: any) => {
        return (
            // @cspell: disable-next-line
            <div data-testid="monaco-editor" data-theme={theme} defaultlanguage={defaultLanguage} {...props}>
                <button onClick={() => onMount?.(mockEditor, mockMonaco)} data-testid="trigger-mount">
                    Mount Editor
                </button>
                <input data-testid="editor-input" onChange={e => onChange?.(e.target.value)} />
                {loading}
            </div>
        );
    },
}));

vi.mock("@/theme/hook", () => ({
    useTheme: vi.fn(),
}));

vi.mock("@/features/editor/hooks/useMonacoEditor", () => ({
    useEditorOptions: vi.fn(),
}));

describe("CodeEditor", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useTheme).mockReturnValue({
            theme: "light",
            setTheme: vi.fn(),
            toggle: vi.fn(),
        });
        vi.mocked(useEditorOptions).mockReturnValue({
            fontSize: 13,
            fontLigatures: true,
            minimap: { enabled: false },
            cursorBlinking: "blink",
            scrollBeyondLastLine: false,
            smoothScrolling: false,
            automaticLayout: false,
            wordWrap: "on",
            renderWhitespace: "selection",
            tabSize: 0,
        });
        mockMonaco.editor.getModel.mockReturnValue(null);
    });

    it("renders with default props", () => {
        render(<CodeEditor value="test content" />);

        expect(screen.getByTestId("monaco-editor")).toBeInTheDocument();
        expect(screen.getByTestId("monaco-editor")).toHaveAttribute("value", "test content");
    });

    it("applies default className", () => {
        const { container } = render(<CodeEditor value="test" />);

        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper).toHaveClass("h-full", "w-full");
    });

    it("applies custom className", () => {
        const { container } = render(<CodeEditor value="test" className="custom-editor" />);

        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper).toHaveClass("custom-editor");
    });

    it("uses light theme by default", () => {
        render(<CodeEditor value="test" />);

        expect(screen.getByTestId("monaco-editor")).toHaveAttribute("data-theme", "vs");
    });

    it("uses dark theme when theme is dark", () => {
        vi.mocked(useTheme).mockReturnValue({
            theme: "dark",
            setTheme: vi.fn(),
            toggle: vi.fn(),
        });

        render(<CodeEditor value="test" />);

        expect(screen.getByTestId("monaco-editor")).toHaveAttribute("data-theme", "vs-dark");
    });

    it("passes language prop", () => {
        render(<CodeEditor value="print('hello')" language="python" />);

        expect(screen.getByTestId("monaco-editor")).toHaveAttribute("defaultLanguage", "python");
    });

    it("uses plaintext as default language", () => {
        render(<CodeEditor value="test" />);

        expect(screen.getByTestId("monaco-editor")).toHaveAttribute("defaultLanguage", "plaintext");
    });

    it("calls onChange when editor value changes", () => {
        const onChange = vi.fn();
        render(<CodeEditor value="initial" onChange={onChange} />);

        fireEvent.change(screen.getByTestId("editor-input"), {
            target: { value: "changed content" },
        });

        expect(onChange).toHaveBeenCalledWith("changed content");
    });

    it("sets up model on mount with file path", () => {
        render(<CodeEditor value="test content" language="typescript" path="/test/file.ts" />);

        fireEvent.click(screen.getByTestId("trigger-mount"));

        expect(mockMonaco.Uri.parse).toHaveBeenCalledWith("file:///test/file.ts");
        expect(mockMonaco.editor.createModel).toHaveBeenCalledWith("test content", "typescript", "mock-uri");
        expect(mockEditor.setModel).toHaveBeenCalledWith(mockModel);
    });

    it("sets up model on mount with inmemory URI", () => {
        render(<CodeEditor value="test" path="inmemory://test.js" />);

        fireEvent.click(screen.getByTestId("trigger-mount"));

        expect(mockMonaco.Uri.parse).toHaveBeenCalledWith("inmemory://test.js");
    });

    it("reuses existing model when available", () => {
        mockMonaco.editor.getModel.mockReturnValue(mockModel);

        render(<CodeEditor value="new content" language="javascript" />);

        fireEvent.click(screen.getByTestId("trigger-mount"));

        expect(mockModel.setValue).toHaveBeenCalledWith("new content");
        expect(mockMonaco.editor.setModelLanguage).toHaveBeenCalledWith(mockModel, "javascript");
        expect(mockEditor.setModel).toHaveBeenCalledWith(mockModel);
    });

    it("handles model creation errors gracefully", () => {
        mockMonaco.Uri.parse.mockImplementation(() => {
            throw new Error("Invalid URI");
        });

        expect(() => {
            render(<CodeEditor value="test" />);
            fireEvent.click(screen.getByTestId("trigger-mount"));
        }).not.toThrow();
    });

    it("adds save keyboard shortcut", () => {
        const onSave = vi.fn();
        render(<CodeEditor value="content" onSave={onSave} />);

        fireEvent.click(screen.getByTestId("trigger-mount"));

        expect(mockEditor.addCommand).toHaveBeenCalledWith(
            2048 | 49, // CtrlCmd | KeyS
            expect.any(Function),
        );
    });

    it("executes save callback when shortcut is pressed", () => {
        const onSave = vi.fn();
        mockEditor.getValue.mockReturnValue("editor content");

        render(<CodeEditor value="content" onSave={onSave} />);

        fireEvent.click(screen.getByTestId("trigger-mount"));

        // Get the command callback and execute it
        const saveCallback = mockEditor.addCommand.mock.calls[0][1];
        saveCallback();

        expect(mockEditor.getValue).toHaveBeenCalled();
        expect(onSave).toHaveBeenCalledWith("editor content");
    });

    it("does not add save command when onSave is not provided", () => {
        render(<CodeEditor value="content" />);

        fireEvent.click(screen.getByTestId("trigger-mount"));

        const saveCallback = mockEditor.addCommand.mock.calls[0][1];
        expect(() => saveCallback()).not.toThrow();
    });

    it("passes merged options to editor", () => {
        const customOptions = { fontSize: 16, readOnly: true };
        vi.mocked(useEditorOptions).mockReturnValue({
            fontSize: 16,
            fontLigatures: true,
            readOnly: true,
            minimap: { enabled: false },
            cursorBlinking: "smooth",
            scrollBeyondLastLine: false,
            smoothScrolling: false,
            automaticLayout: false,
            wordWrap: "on",
            renderWhitespace: "selection",
            tabSize: 0,
        });

        render(<CodeEditor value="test" options={customOptions} />);

        expect(useEditorOptions).toHaveBeenCalledWith({
            // readOnly: false, // default
            ...customOptions,
        });
    });

    it("handles readOnly prop", () => {
        render(<CodeEditor value="test" readOnly={true} />);

        expect(useEditorOptions).toHaveBeenCalledWith({ readOnly: true });
    });

    it("displays loading state", () => {
        render(<CodeEditor value="test" />);

        expect(screen.getByText("Loading editor…")).toBeInTheDocument();
    });

    it("uses default path when not provided", () => {
        render(<CodeEditor value="test" />);

        fireEvent.click(screen.getByTestId("trigger-mount"));

        expect(mockMonaco.Uri.parse).toHaveBeenCalledWith("inmemory://model.txt");
    });

    it("handles all prop combinations", () => {
        const props = {
            value: "test code",
            onChange: vi.fn(),
            language: "python",
            path: "/src/main.py",
            readOnly: true,
            onSave: vi.fn(),
            options: { fontSize: 14 },
            className: "custom-editor",
        };

        render(<CodeEditor {...props} />);

        const editor = screen.getByTestId("monaco-editor");
        expect(editor).toHaveAttribute("value", "test code");
        expect(editor).toHaveAttribute("defaultLanguage", "python");

        const wrapper = editor.parentElement;
        expect(wrapper).toHaveClass("custom-editor");
    });
});
