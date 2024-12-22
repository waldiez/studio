import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionButtons } from "@waldiez/studio/components/FileBrowser/ActionButtons";
import { vi } from "vitest";

describe("ActionButtons Component", () => {
    it('calls onNewFile when "New Flow" button is clicked', async () => {
        const onNewFileMock = vi.fn();
        render(<ActionButtons onNewFile={onNewFileMock} onNewFolder={vi.fn()} onUpload={vi.fn()} />);

        const newFileButton = screen.getByText("New Flow");
        await userEvent.click(newFileButton);

        expect(onNewFileMock).toHaveBeenCalledTimes(1);
    });

    it('calls onNewFolder when "New Folder" button is clicked', async () => {
        const onNewFolderMock = vi.fn();
        render(<ActionButtons onNewFile={vi.fn()} onNewFolder={onNewFolderMock} onUpload={vi.fn()} />);

        const newFolderButton = screen.getByText("New Folder");
        await userEvent.click(newFolderButton);

        expect(onNewFolderMock).toHaveBeenCalledTimes(1);
    });

    it("calls onUpload when file is uploaded", async () => {
        const onUploadMock = vi.fn();
        render(<ActionButtons onNewFile={vi.fn()} onNewFolder={vi.fn()} onUpload={onUploadMock} />);

        const uploadButton = screen.getByText("Upload");
        await userEvent.click(uploadButton);

        const fileInput = screen.getByTestId("file-input");
        const file = new File(["file contents"], "test.txt", { type: "text/plain" });
        await userEvent.upload(fileInput, file);

        expect(onUploadMock).toHaveBeenCalledWith(file);
    });
    it("does not call onUpload when no file is selected", async () => {
        const onUploadMock = vi.fn();
        render(<ActionButtons onNewFile={vi.fn()} onNewFolder={vi.fn()} onUpload={onUploadMock} />);

        const fileInput = screen.getByTestId("file-input");

        fireEvent.change(fileInput, { target: { files: [] } });

        expect(onUploadMock).not.toHaveBeenCalled();
    });

    it("handles upload errors gracefully", async () => {
        const onUploadMock = vi.fn().mockRejectedValue(new Error("Upload failed"));
        // Suppress error logs, we expect log.error to be called (on error)
        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        render(<ActionButtons onNewFile={vi.fn()} onNewFolder={vi.fn()} onUpload={onUploadMock} />);

        const fileInput = screen.getByTestId("file-input");
        const file = new File(["content"], "test.txt", { type: "text/plain" });

        await userEvent.upload(fileInput, file);

        expect(onUploadMock).toHaveBeenCalledWith(file);
        consoleErrorSpy.mockRestore();
    });
});
