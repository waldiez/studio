import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { it, vi } from "vitest";

import * as fileBrowserService from "@waldiez/studio/api/fileBrowserService";
import { FileBrowser, FileBrowserProvider } from "@waldiez/studio/components/FileBrowser";
import { SidebarProvider } from "@waldiez/studio/components/Sidebar";

vi.mock("@waldiez/studio/api/fileBrowserService", () => ({
    fetchFiles: vi.fn().mockResolvedValue({
        items: [
            { name: "test.txt", path: "/test.txt", type: "file" },
            { name: "folder", path: "/folder", type: "folder" },
        ],
    }),
    createFolder: vi.fn(),
    createFile: vi.fn(),
    deleteFileOrFolder: vi.fn(),
    renameFileOrFolder: vi.fn(),
    uploadFile: vi.fn(),
    downloadFileOrFolder: vi.fn(),
}));

describe("FileBrowser Component", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });
    it("renders file browser with sidebar visible", async () => {
        act(() => {
            render(
                <SidebarProvider>
                    <FileBrowserProvider>
                        <FileBrowser />
                    </FileBrowserProvider>
                </SidebarProvider>,
            );
        });

        await waitFor(() => expect(screen.getByText("Workspace")).toBeInTheDocument());
    });

    it("renders error message if present", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        render(
            <SidebarProvider>
                <FileBrowserProvider>
                    <FileBrowser />
                </FileBrowserProvider>
            </SidebarProvider>,
        );

        expect(screen.queryByText("Error")).toBeNull();
    });

    it("renders entries in the sidebar", async () => {
        render(
            <SidebarProvider>
                <FileBrowserProvider>
                    <FileBrowser />
                </FileBrowserProvider>
            </SidebarProvider>,
        );
        expect(await screen.findByText("test.txt")).toBeInTheDocument();
        expect(await screen.findByText("folder")).toBeInTheDocument();
    });

    it("does not render entries or actions when sidebar is hidden", () => {
        render(
            <SidebarProvider initialVisible={false}>
                <FileBrowserProvider>
                    <FileBrowser />
                </FileBrowserProvider>
            </SidebarProvider>,
        );

        expect(screen.queryByText("Workspace")).not.toBeInTheDocument();
    });
    it("handles folder creation", async () => {
        const createFolderMock = vi.fn().mockResolvedValue({});
        vi.mocked(fileBrowserService.createFolder).mockImplementation(createFolderMock);

        render(
            <SidebarProvider>
                <FileBrowserProvider>
                    <FileBrowser />
                </FileBrowserProvider>
            </SidebarProvider>,
        );

        act(() => {
            screen.getByText("New Folder").click();
        });

        await waitFor(() => expect(createFolderMock).toHaveBeenCalled());
    });

    it("handles file creation", async () => {
        const createFileMock = vi.fn().mockResolvedValue({});
        vi.mocked(fileBrowserService.createFile).mockImplementation(createFileMock);
        render(
            <SidebarProvider>
                <FileBrowserProvider>
                    <FileBrowser />
                </FileBrowserProvider>
            </SidebarProvider>,
        );

        act(() => {
            screen.getByText("New Flow").click();
        });

        await waitFor(() => expect(createFileMock).toHaveBeenCalled());
    });

    it("handles item deletion", async () => {
        const deleteMock = vi.fn().mockResolvedValue({});
        vi.mocked(fileBrowserService.deleteFileOrFolder).mockImplementation(deleteMock);
        vi.mocked(fileBrowserService.fetchFiles).mockResolvedValue({
            items: [{ name: "test.txt", path: "/test.txt", type: "file" }],
        });
        render(
            <SidebarProvider>
                <FileBrowserProvider>
                    <FileBrowser />
                </FileBrowserProvider>
            </SidebarProvider>,
        );

        await waitFor(() => expect(screen.getByTestId("delete-button")).toBeInTheDocument());

        act(() => {
            fireEvent.click(screen.getByTestId("delete-button"));
        });

        await waitFor(() => expect(deleteMock).toHaveBeenCalled());
    });

    it("handles renaming an item", async () => {
        const renameMock = vi.fn().mockResolvedValue({});
        vi.mocked(fileBrowserService.renameFileOrFolder).mockImplementation(renameMock);
        vi.mocked(fileBrowserService.fetchFiles).mockResolvedValue({
            items: [{ name: "Folder1", path: "/Folder1", type: "folder" }],
        });

        render(
            <SidebarProvider>
                <FileBrowserProvider>
                    <FileBrowser />
                </FileBrowserProvider>
            </SidebarProvider>,
        );

        await waitFor(() => expect(screen.getByTestId("edit-button")).toBeInTheDocument());

        act(() => {
            fireEvent.click(screen.getByTestId("edit-button"));
        });

        await waitFor(() => expect(screen.getByTestId("path-name-input")).toBeInTheDocument());

        const inputElement = screen.getByTestId("path-name-input");
        act(() => {
            fireEvent.change(inputElement, { target: { value: "Folder2" } });
            fireEvent.click(screen.getByTestId("save-button"));
        });

        await waitFor(() => expect(renameMock).toHaveBeenCalled());
    });

    it("handles navigation", async () => {
        const fetchFilesMock = vi.fn().mockResolvedValue({
            items: [{ name: "folder", path: "/folder", type: "folder" }],
        });
        vi.mocked(fileBrowserService.fetchFiles).mockImplementation(fetchFilesMock);

        render(
            <SidebarProvider>
                <FileBrowserProvider>
                    <FileBrowser />
                </FileBrowserProvider>
            </SidebarProvider>,
        );

        await waitFor(() => expect(screen.getByTestId("path-navigate")).toBeInTheDocument());
        let pathItem = screen.getByTestId("path-navigate");
        act(() => {
            fireEvent.click(pathItem);
        });

        await waitFor(() => expect(screen.getByTestId("path-navigate")).toBeInTheDocument());
        pathItem = screen.getByTestId("path-navigate");
        act(() => {
            fireEvent.click(pathItem);
        });
    });

    it("refreshes the file list", async () => {
        const refreshMock = vi.fn();
        vi.mocked(fileBrowserService.fetchFiles).mockImplementation(refreshMock);

        render(
            <SidebarProvider>
                <FileBrowserProvider>
                    <FileBrowser />
                </FileBrowserProvider>
            </SidebarProvider>,
        );
        act(() => {
            fireEvent.click(screen.getByTestId("refresh-button"));
        });

        await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    });

    it("handles errors when creating a folder", async () => {
        const createFolderMock = vi.fn().mockRejectedValue(new Error("Failed to create folder"));
        vi.mocked(fileBrowserService.createFolder).mockImplementation(createFolderMock);
        render(
            <SidebarProvider>
                <FileBrowserProvider>
                    <FileBrowser />
                </FileBrowserProvider>
            </SidebarProvider>,
        );
        act(() => {
            fireEvent.click(screen.getByTestId("refresh-button"));
        });

        await waitFor(() => expect(screen.getByTestId("error")).toBeInTheDocument());
    });
    it("handles downloading a file", async () => {
        const downloadMock = vi.fn().mockResolvedValue({});
        vi.mocked(fileBrowserService.downloadFileOrFolder).mockImplementation(downloadMock);
        vi.mocked(fileBrowserService.fetchFiles).mockResolvedValue({
            items: [{ name: "test.txt", path: "/test.txt", type: "file" }],
        });
        render(
            <SidebarProvider>
                <FileBrowserProvider>
                    <FileBrowser />
                </FileBrowserProvider>
            </SidebarProvider>,
        );

        await waitFor(() => expect(screen.getByTestId("path-item")).toBeInTheDocument());
        const pathItem = screen.getByTestId("path-item");
        await act(async () => {
            fireEvent.contextMenu(pathItem, { bubbles: true });
        });
        await waitFor(() => expect(screen.getByText("Download")).toBeInTheDocument());
        const downloadButton = screen.getByText("Download");
        await act(async () => {
            fireEvent.click(downloadButton);
        });
        await waitFor(() => expect(downloadMock).toHaveBeenCalled());
    });
    it("handles uploading a file", async () => {
        const uploadMock = vi.fn().mockResolvedValue({});
        vi.mocked(fileBrowserService.uploadFile).mockImplementation(uploadMock);
        vi.mocked(fileBrowserService.fetchFiles).mockResolvedValue({
            items: [{ name: "test.txt", path: "/test.txt", type: "file" }],
        });
        render(
            <SidebarProvider>
                <FileBrowserProvider>
                    <FileBrowser />
                </FileBrowserProvider>
            </SidebarProvider>,
        );

        await waitFor(() => expect(screen.getByTestId("upload-button")).toBeInTheDocument());
        const uploadButton = screen.getByTestId("upload-button");
        act(() => {
            fireEvent.click(uploadButton);
            const file = new File([""], "test.txt", { type: "text/plain" });
            fireEvent.change(screen.getByTestId("file-input"), { target: { files: [file] } });
        });

        await waitFor(() => expect(uploadMock).toHaveBeenCalled());
    });
});
