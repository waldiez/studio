/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FileBrowser, FileBrowserProvider } from "@waldiez/studio/components/FileBrowser";
import { SidebarProvider } from "@waldiez/studio/components/Sidebar";
import { WaldiezWrapper } from "@waldiez/studio/components/WaldiezWrapper";

vi.mock("@waldiez/studio/api/fileBrowserService", () => ({
    fetchFiles: vi.fn().mockResolvedValue({
        items: [{ name: "test.waldiez", path: "/test.waldiez", type: "file" }],
    }),
}));

vi.mock("@waldiez/studio/api/waldiezFlowService", () => ({
    getFlowContents: vi
        .fn()
        .mockImplementation(
            () => new Promise(resolve => setTimeout(() => resolve('{"type": "flow", "nodes": []}'), 100)),
        ),
    saveFlow: vi.fn().mockResolvedValue({}),
    convertFlow: vi.fn().mockResolvedValue({}),
}));

vi.mock("@waldiez/react", () => ({
    Waldiez: ({ flowId }: { flowId: string }) => (
        <div data-testid="waldiez-component" data-flow-id={flowId}>
            Waldiez Component Loaded
            <button title="Run flow">Run</button>
        </div>
    ),
    importFlow: vi.fn().mockReturnValue({
        flowId: "test-flow-id",
        name: "Test Flow",
        description: "Test Description",
    }),
    showSnackbar: vi.fn(),
}));

describe("FileBrowser Component", () => {
    const mockMatchMedia = (matches = false) => {
        vi.spyOn(window, "matchMedia").mockImplementation(query => ({
            matches,
            media: query,
            onchange: null,
            addListener: vi.fn(), // Deprecated
            removeListener: vi.fn(), // Deprecated
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));
    };
    afterEach(() => {
        vi.clearAllMocks();
    });
    beforeEach(() => {
        mockMatchMedia();
        window.location.hash = "/";
    });
    it("displays fallback UI when no .waldiez file is selected", async () => {
        await act(async () => {
            render(
                <SidebarProvider>
                    <FileBrowserProvider>
                        <WaldiezWrapper />
                    </FileBrowserProvider>
                </SidebarProvider>,
            );
        });
        expect(screen.getByTestId("waldiez-no-flow")).toBeInTheDocument();
        expect(screen.getByTestId("waldiez-no-flow")).toHaveTextContent(
            "Create a new file or select an existing .waldiez file to start",
        );
    });
    it("displays loading UI when .waldiez file is selected", async () => {
        await act(async () => {
            render(
                <SidebarProvider>
                    <FileBrowserProvider>
                        <FileBrowser />
                        <WaldiezWrapper />
                    </FileBrowserProvider>
                </SidebarProvider>,
            );
        });

        await waitFor(() => expect(screen.getByTestId("path-navigate")).toBeInTheDocument());

        const navigationElement = screen.getByTestId("path-navigate");

        await act(async () => {
            fireEvent.click(navigationElement);
        });

        await waitFor(() => expect(screen.getByTestId("waldiez-loading-flow")).toBeInTheDocument());
    });

    it("displays Waldiez UI when a .waldiez file is loaded", async () => {
        await act(async () => {
            render(
                <SidebarProvider>
                    <FileBrowserProvider>
                        <FileBrowser />
                        <WaldiezWrapper />
                    </FileBrowserProvider>
                </SidebarProvider>,
            );
        });
        await userEvent.click(screen.getByTestId("path-navigate"));
        waitFor(() => {
            expect(screen.getByTestId("waldiez-loading-flow")).toBeInTheDocument();
        });
        await waitFor(() => expect(screen.queryByTestId("waldiez-loading-flow")).toBeFalsy());
        await waitFor(() => expect(screen.queryAllByTitle("Run flow")).toBeTruthy());
    });
});
