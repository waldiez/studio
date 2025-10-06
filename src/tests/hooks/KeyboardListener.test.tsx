/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import KeyboardListener from "@/hooks/KeyboardListener";
import { useWorkspace } from "@/store/workspace";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/store/workspace", () => ({
    useWorkspace: {
        getState: vi.fn(),
    },
}));

describe("KeyboardListener", () => {
    const mockCloseTab = vi.fn();
    const mockSetActiveTab = vi.fn();

    const mockState = {
        openTabs: [
            { id: "tab-1", item: { path: "/file1.txt", type: "file", name: "file1.txt" } },
            { id: "tab-2", item: { path: "/file2.txt", type: "file", name: "file2.txt" } },
            { id: "tab-3", item: { path: "/file3.txt", type: "file", name: "file3.txt" } },
        ],
        activeTabId: "tab-1",
        closeTab: mockCloseTab,
        setActiveTab: mockSetActiveTab,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (useWorkspace.getState as any).mockReturnValue(mockState);
    });

    const fireKeyDown = (options: Partial<KeyboardEventInit>) => {
        const event = new KeyboardEvent("keydown", options);
        window.dispatchEvent(event);
        return event;
    };

    it("renders without crashing", () => {
        const { result } = renderHook(() => KeyboardListener());
        expect(result.current).toBeNull();
    });

    describe("Close tab shortcuts", () => {
        it("closes active tab with Cmd+W", () => {
            renderHook(() => KeyboardListener());

            fireKeyDown({ metaKey: true, code: "KeyW" });

            expect(mockCloseTab).toHaveBeenCalledWith("tab-1");
        });

        it("closes active tab with Ctrl+W", () => {
            renderHook(() => KeyboardListener());

            fireKeyDown({ ctrlKey: true, code: "KeyW" });

            expect(mockCloseTab).toHaveBeenCalledWith("tab-1");
        });

        it("closes active tab with Alt+W", () => {
            renderHook(() => KeyboardListener());

            fireKeyDown({ altKey: true, code: "KeyW" });

            expect(mockCloseTab).toHaveBeenCalledWith("tab-1");
        });

        it("does not close tab when both Cmd and Alt are pressed", () => {
            renderHook(() => KeyboardListener());

            fireKeyDown({ metaKey: true, altKey: true, code: "KeyW" });

            expect(mockCloseTab).not.toHaveBeenCalled();
        });

        it("does not close tab when no tabs are open", () => {
            (useWorkspace.getState as any).mockReturnValue({
                ...mockState,
                openTabs: [],
                activeTabId: null,
            });

            renderHook(() => KeyboardListener());

            fireKeyDown({ metaKey: true, code: "KeyW" });

            expect(mockCloseTab).not.toHaveBeenCalled();
        });
    });

    describe("Switch to tab by index with Cmd/Ctrl", () => {
        it("switches to tab 1 with Cmd+1", () => {
            renderHook(() => KeyboardListener());

            fireKeyDown({ metaKey: true, code: "Digit1" });

            expect(mockSetActiveTab).toHaveBeenCalledWith("tab-1");
        });

        it("switches to tab 2 with Ctrl+2", () => {
            renderHook(() => KeyboardListener());

            fireKeyDown({ ctrlKey: true, code: "Digit2" });

            expect(mockSetActiveTab).toHaveBeenCalledWith("tab-2");
        });

        it("switches to tab 3 with Cmd+3", () => {
            renderHook(() => KeyboardListener());

            fireKeyDown({ metaKey: true, code: "Digit3" });

            expect(mockSetActiveTab).toHaveBeenCalledWith("tab-3");
        });

        it("does not switch when index is out of bounds", () => {
            renderHook(() => KeyboardListener());

            fireKeyDown({ metaKey: true, code: "Digit9" });

            expect(mockSetActiveTab).not.toHaveBeenCalled();
        });

        it("does not trigger when Alt is also pressed", () => {
            renderHook(() => KeyboardListener());

            fireKeyDown({ metaKey: true, altKey: true, code: "Digit1" });

            expect(mockSetActiveTab).not.toHaveBeenCalled();
        });
    });

    describe("Switch to tab by index with Alt", () => {
        it("switches to tab 1 with Alt+1", () => {
            renderHook(() => KeyboardListener());

            fireKeyDown({ altKey: true, code: "Digit1" });

            expect(mockSetActiveTab).toHaveBeenCalledWith("tab-1");
        });

        it("switches to tab 2 with Alt+2", () => {
            renderHook(() => KeyboardListener());

            fireKeyDown({ altKey: true, code: "Digit2" });

            expect(mockSetActiveTab).toHaveBeenCalledWith("tab-2");
        });

        it("does not switch when Cmd is also pressed", () => {
            renderHook(() => KeyboardListener());

            fireKeyDown({ altKey: true, metaKey: true, code: "Digit1" });

            expect(mockSetActiveTab).not.toHaveBeenCalled();
        });

        it("does not switch when Ctrl is also pressed", () => {
            renderHook(() => KeyboardListener());

            fireKeyDown({ altKey: true, ctrlKey: true, code: "Digit1" });

            expect(mockSetActiveTab).not.toHaveBeenCalled();
        });
    });

    describe("Navigate with Alt + Arrow keys", () => {
        it("navigates to next tab with Alt+ArrowRight", () => {
            renderHook(() => KeyboardListener());

            fireKeyDown({ altKey: true, code: "ArrowRight" });

            expect(mockSetActiveTab).toHaveBeenCalledWith("tab-2");
        });

        it("navigates to previous tab with Alt+ArrowLeft", () => {
            (useWorkspace.getState as any).mockReturnValue({
                ...mockState,
                activeTabId: "tab-2",
            });

            renderHook(() => KeyboardListener());

            fireKeyDown({ altKey: true, code: "ArrowLeft" });

            expect(mockSetActiveTab).toHaveBeenCalledWith("tab-1");
        });

        it("wraps to first tab when at last tab and pressing ArrowRight", () => {
            (useWorkspace.getState as any).mockReturnValue({
                ...mockState,
                activeTabId: "tab-3",
            });

            renderHook(() => KeyboardListener());

            fireKeyDown({ altKey: true, code: "ArrowRight" });

            expect(mockSetActiveTab).toHaveBeenCalledWith("tab-1");
        });

        it("wraps to last tab when at first tab and pressing ArrowLeft", () => {
            renderHook(() => KeyboardListener());

            fireKeyDown({ altKey: true, code: "ArrowLeft" });

            expect(mockSetActiveTab).toHaveBeenCalledWith("tab-3");
        });

        it("does not navigate when only one tab is open", () => {
            (useWorkspace.getState as any).mockReturnValue({
                ...mockState,
                openTabs: [mockState.openTabs[0]],
            });

            renderHook(() => KeyboardListener());

            fireKeyDown({ altKey: true, code: "ArrowRight" });

            expect(mockSetActiveTab).not.toHaveBeenCalled();
        });

        it("does not navigate when Cmd is also pressed", () => {
            renderHook(() => KeyboardListener());

            fireKeyDown({ altKey: true, metaKey: true, code: "ArrowRight" });

            expect(mockSetActiveTab).not.toHaveBeenCalled();
        });
    });

    describe("Navigate with Cmd/Ctrl + Shift + Brackets", () => {
        it("navigates to next tab with Cmd+Shift+]", () => {
            renderHook(() => KeyboardListener());

            fireKeyDown({ metaKey: true, shiftKey: true, code: "BracketRight" });

            expect(mockSetActiveTab).toHaveBeenCalledWith("tab-2");
        });

        it("navigates to previous tab with Cmd+Shift+[", () => {
            (useWorkspace.getState as any).mockReturnValue({
                ...mockState,
                activeTabId: "tab-2",
            });

            renderHook(() => KeyboardListener());

            fireKeyDown({ metaKey: true, shiftKey: true, code: "BracketLeft" });

            expect(mockSetActiveTab).toHaveBeenCalledWith("tab-1");
        });

        it("wraps to first tab when at last tab with Ctrl+Shift+]", () => {
            (useWorkspace.getState as any).mockReturnValue({
                ...mockState,
                activeTabId: "tab-3",
            });

            renderHook(() => KeyboardListener());

            fireKeyDown({ ctrlKey: true, shiftKey: true, code: "BracketRight" });

            expect(mockSetActiveTab).toHaveBeenCalledWith("tab-1");
        });

        it("wraps to last tab when at first tab with Ctrl+Shift+[", () => {
            renderHook(() => KeyboardListener());

            fireKeyDown({ ctrlKey: true, shiftKey: true, code: "BracketLeft" });

            expect(mockSetActiveTab).toHaveBeenCalledWith("tab-3");
        });

        it("does not navigate when only one tab is open", () => {
            (useWorkspace.getState as any).mockReturnValue({
                ...mockState,
                openTabs: [mockState.openTabs[0]],
            });

            renderHook(() => KeyboardListener());

            fireKeyDown({ metaKey: true, shiftKey: true, code: "BracketRight" });

            expect(mockSetActiveTab).not.toHaveBeenCalled();
        });
    });

    describe("Event listener cleanup", () => {
        it("removes event listener on unmount", () => {
            const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

            const { unmount } = renderHook(() => KeyboardListener());

            unmount();

            expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));

            removeEventListenerSpy.mockRestore();
        });
    });
});
