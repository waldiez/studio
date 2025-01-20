import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, it, vi } from "vitest";

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

    it("displays Waldiez UI when .waldiez file is loaded", async () => {
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
        await act(async () => {
            fireEvent.click(screen.getByTestId("path-navigate"));
        });
        await act(async () => {
            await waitFor(async () => {
                expect(screen.getByTestId("waldiez-loading-flow")).toBeInTheDocument();
            });
        });
        waitFor(() => expect(screen.queryByTestId("waldiez-loading-flow")).toBeFalsy());
        await waitFor(() => expect(screen.queryAllByTitle("Run flow")).toBeTruthy());
    });
});
