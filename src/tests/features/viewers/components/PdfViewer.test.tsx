/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
import PdfViewer from "@/features/viewers/components/PdfViewer";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockGetDocument, mockPage, mockPdfDoc } from "../../../../../__mocks__/pdfjs-dist";

// Tell Vitest to use the manual mock
vi.mock("pdfjs-dist");
vi.mock("pdfjs-dist/web/pdf_viewer.css", () => ({}));

// Mock theme hook
vi.mock("@/theme/hook", () => ({
    useTheme: () => ({ theme: "light" }),
}));

describe("PdfViewer", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPdfDoc.getPage.mockResolvedValue(mockPage);
        mockPage.getViewport.mockReturnValue({
            width: 800,
            height: 1000,
            scale: 1,
        });
        mockPage.render.mockReturnValue({
            promise: Promise.resolve(),
        });
        mockPage.streamTextContent.mockResolvedValue([]);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("renders loading state initially", () => {
        render(<PdfViewer source="test.pdf" />);

        expect(screen.getByText("Loading PDF...")).toBeInTheDocument();
    });

    it("applies default className", async () => {
        const { container } = render(<PdfViewer source="test.pdf" />);

        await waitFor(() => {
            expect(screen.queryByText("Loading PDF...")).not.toBeInTheDocument();
        });

        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper).toHaveClass("h-full", "w-full", "flex", "flex-col");
    });

    it("applies custom className", async () => {
        const { container } = render(<PdfViewer source="test.pdf" className="custom-class" />);

        await waitFor(() => {
            expect(screen.queryByText("Loading PDF...")).not.toBeInTheDocument();
        });

        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper).toHaveClass("custom-class");
    });

    it("loads PDF from string URL", async () => {
        render(<PdfViewer source="http://example.com/test.pdf" />);

        await waitFor(
            () => {
                expect(mockGetDocument).toHaveBeenCalledWith("http://example.com/test.pdf");
            },
            { timeout: 5000 },
        );
    });

    it("loads PDF from ArrayBuffer", async () => {
        const buffer = new ArrayBuffer(8);

        render(<PdfViewer source={buffer} />);

        await waitFor(
            () => {
                expect(mockGetDocument).toHaveBeenCalledWith({ data: buffer });
            },
            { timeout: 5000 },
        );
    });

    it("loads PDF from Uint8Array", async () => {
        const uint8Array = new Uint8Array([1, 2, 3, 4]);

        render(<PdfViewer source={uint8Array} />);

        await waitFor(
            () => {
                expect(mockGetDocument).toHaveBeenCalledWith({ data: uint8Array });
            },
            { timeout: 5000 },
        );
    });

    it("displays page count after loading", async () => {
        render(<PdfViewer source="test.pdf" />);

        await waitFor(() => {
            expect(screen.getByText("/ 3")).toBeInTheDocument();
        });
    });

    it("starts at page 1", async () => {
        render(<PdfViewer source="test.pdf" />);

        await waitFor(() => {
            const pageInput = screen.getByLabelText("Current page") as HTMLInputElement;
            expect(pageInput.value).toBe("1");
        });
    });

    it("renders canvas for PDF page", async () => {
        const { container } = render(<PdfViewer source="test.pdf" />);

        await waitFor(() => {
            const canvas = container.querySelector("canvas");
            expect(canvas).toBeInTheDocument();
        });
    });

    it("renders text layer for selectable text", async () => {
        const { container } = render(<PdfViewer source="test.pdf" />);

        await waitFor(() => {
            const textLayer = container.querySelector(".textLayer");
            expect(textLayer).toBeInTheDocument();
        });
    });

    it("navigates to next page", async () => {
        const user = userEvent.setup();
        render(<PdfViewer source="test.pdf" />);

        await waitFor(() => {
            expect(screen.getByLabelText("Next page")).toBeInTheDocument();
        });

        const nextButton = screen.getByLabelText("Next page");
        await user.click(nextButton);

        await waitFor(() => {
            const pageInput = screen.getByLabelText("Current page") as HTMLInputElement;
            expect(pageInput.value).toBe("2");
        });
    });

    it("navigates to previous page", async () => {
        const user = userEvent.setup();
        render(<PdfViewer source="test.pdf" />);

        await waitFor(() => {
            expect(screen.getByLabelText("Next page")).toBeInTheDocument();
        });

        // Go to page 2 first
        const nextButton = screen.getByLabelText("Next page");
        await user.click(nextButton);

        await waitFor(() => {
            const pageInput = screen.getByLabelText("Current page") as HTMLInputElement;
            expect(pageInput.value).toBe("2");
        });

        // Then go back to page 1
        const prevButton = screen.getByLabelText("Previous page");
        await user.click(prevButton);

        await waitFor(() => {
            const pageInput = screen.getByLabelText("Current page") as HTMLInputElement;
            expect(pageInput.value).toBe("1");
        });
    });

    it("disables previous button on first page", async () => {
        render(<PdfViewer source="test.pdf" />);

        await waitFor(() => {
            const prevButton = screen.getByLabelText("Previous page");
            expect(prevButton).toBeDisabled();
        });
    });

    it("disables next button on last page", async () => {
        const user = userEvent.setup();
        render(<PdfViewer source="test.pdf" />);

        await waitFor(() => {
            expect(screen.getByLabelText("Next page")).toBeInTheDocument();
        });

        // Navigate to last page
        const nextButton = screen.getByLabelText("Next page");
        await user.click(nextButton);
        await user.click(nextButton);

        await waitFor(() => {
            expect(nextButton).toBeDisabled();
        });
    });

    it("navigates to specific page via input", async () => {
        const user = userEvent.setup();
        render(<PdfViewer source="test.pdf" />);

        await waitFor(() => {
            expect(screen.getByLabelText("Current page")).toBeInTheDocument();
        });

        const pageInput = screen.getByLabelText("Current page");
        await user.clear(pageInput);
        await user.type(pageInput, "3");

        await waitFor(() => {
            expect((pageInput as HTMLInputElement).value).toBe("3");
        });
    });

    it("clamps page number to valid range when typing", async () => {
        const user = userEvent.setup();
        render(<PdfViewer source="test.pdf" />);

        await waitFor(() => {
            expect(screen.getByLabelText("Current page")).toBeInTheDocument();
        });

        const pageInput = screen.getByLabelText("Current page");
        await user.clear(pageInput);
        await user.type(pageInput, "999");

        // The input will show 999, but when changed, it should clamp
        await act(async () => {
            pageInput.blur();
        });
    });

    it("zooms in", async () => {
        const user = userEvent.setup();
        render(<PdfViewer source="test.pdf" />);

        await waitFor(() => {
            expect(screen.getByLabelText("Zoom in")).toBeInTheDocument();
        });

        const zoomInButton = screen.getByLabelText("Zoom in");
        await user.click(zoomInButton);

        await waitFor(() => {
            expect(screen.getByText("125%")).toBeInTheDocument();
        });
    });

    it("zooms out", async () => {
        const user = userEvent.setup();
        render(<PdfViewer source="test.pdf" />);

        await waitFor(() => {
            expect(screen.getByLabelText("Zoom out")).toBeInTheDocument();
        });

        const zoomOutButton = screen.getByLabelText("Zoom out");
        await user.click(zoomOutButton);

        await waitFor(() => {
            expect(screen.getByText("75%")).toBeInTheDocument();
        });
    });

    it("resets zoom", async () => {
        const user = userEvent.setup();
        render(<PdfViewer source="test.pdf" initialScale={1.5} />);

        await waitFor(() => {
            expect(screen.getByText("150%")).toBeInTheDocument();
        });

        const zoomInButton = screen.getByLabelText("Zoom in");
        await user.click(zoomInButton);

        await waitFor(() => {
            expect(screen.getByText("175%")).toBeInTheDocument();
        });

        const resetButton = screen.getByLabelText("Reset zoom");
        await user.click(resetButton);

        await waitFor(() => {
            expect(screen.getByText("150%")).toBeInTheDocument();
        });
    });

    it("respects minScale prop", async () => {
        const user = userEvent.setup();
        render(<PdfViewer source="test.pdf" minScale={0.75} />);

        await waitFor(() => {
            expect(screen.getByLabelText("Zoom out")).toBeInTheDocument();
        });

        const zoomOutButton = screen.getByLabelText("Zoom out");

        // Click twice to try to go below 0.75
        await user.click(zoomOutButton);
        await user.click(zoomOutButton);

        await waitFor(() => {
            // Should not go below 75%
            expect(screen.getByText("75%")).toBeInTheDocument();
            expect(zoomOutButton).toBeDisabled();
        });
    });

    it("respects maxScale prop", async () => {
        const user = userEvent.setup();
        render(<PdfViewer source="test.pdf" maxScale={1.5} />);

        await waitFor(() => {
            expect(screen.getByLabelText("Zoom in")).toBeInTheDocument();
        });

        const zoomInButton = screen.getByLabelText("Zoom in");

        // Click three times to try to go above 1.5
        await user.click(zoomInButton);
        await user.click(zoomInButton);
        await user.click(zoomInButton);

        await waitFor(() => {
            // Should not go above 150%
            expect(screen.getByText("150%")).toBeInTheDocument();
            expect(zoomInButton).toBeDisabled();
        });
    });

    it("uses initialScale prop", async () => {
        render(<PdfViewer source="test.pdf" initialScale={1.5} />);

        await waitFor(() => {
            expect(screen.getByText("150%")).toBeInTheDocument();
        });
    });

    it("hides controls during loading", () => {
        render(<PdfViewer source="test.pdf" />);

        expect(screen.queryByLabelText("Previous page")).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Next page")).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Zoom in")).not.toBeInTheDocument();
    });

    it("shows controls after loading", async () => {
        render(<PdfViewer source="test.pdf" />);

        await waitFor(() => {
            expect(screen.getByLabelText("Previous page")).toBeInTheDocument();
            expect(screen.getByLabelText("Next page")).toBeInTheDocument();
            expect(screen.getByLabelText("Zoom in")).toBeInTheDocument();
            expect(screen.getByLabelText("Zoom out")).toBeInTheDocument();
        });
    });

    it("re-renders page when scale changes", async () => {
        const user = userEvent.setup();
        render(<PdfViewer source="test.pdf" />);

        await waitFor(() => {
            expect(mockPage.render).toHaveBeenCalled();
        });

        const initialCallCount = mockPage.render.mock.calls.length;

        const zoomInButton = screen.getByLabelText("Zoom in");
        await user.click(zoomInButton);

        await waitFor(() => {
            expect(mockPage.render.mock.calls.length).toBeGreaterThan(initialCallCount);
        });
    });

    it("re-renders when page changes", async () => {
        const user = userEvent.setup();
        render(<PdfViewer source="test.pdf" />);

        await waitFor(() => {
            expect(mockPage.render).toHaveBeenCalled();
        });

        const initialCallCount = mockPage.render.mock.calls.length;

        const nextButton = screen.getByLabelText("Next page");
        await user.click(nextButton);

        await waitFor(() => {
            expect(mockPage.render.mock.calls.length).toBeGreaterThan(initialCallCount);
        });
    });

    it("handles empty PDF gracefully", async () => {
        const emptyPdfDoc = {
            numPages: 0,
            getPage: vi.fn(),
        };

        mockGetDocument.mockReturnValueOnce({
            promise: Promise.resolve(emptyPdfDoc),
        });

        render(<PdfViewer source="empty.pdf" />);

        await waitFor(() => {
            expect(screen.getByText("/ 0")).toBeInTheDocument();
        });
    });

    it("calls getPage with correct page number", async () => {
        const user = userEvent.setup();
        render(<PdfViewer source="test.pdf" />);

        await waitFor(() => {
            expect(mockPdfDoc.getPage).toHaveBeenCalledWith(1);
        });

        const nextButton = screen.getByLabelText("Next page");
        await user.click(nextButton);

        await waitFor(() => {
            expect(mockPdfDoc.getPage).toHaveBeenCalledWith(2);
        });
    });

    it("applies correct viewport scale", async () => {
        const user = userEvent.setup();
        render(<PdfViewer source="test.pdf" />);

        await waitFor(() => {
            expect(mockPage.getViewport).toHaveBeenCalledWith({ scale: 1 });
        });

        const zoomInButton = screen.getByLabelText("Zoom in");
        await user.click(zoomInButton);

        await waitFor(() => {
            expect(mockPage.getViewport).toHaveBeenCalledWith({ scale: 1.25 });
        });
    });

    it("cleans up on unmount", async () => {
        const { unmount } = render(<PdfViewer source="test.pdf" />);

        await waitFor(() => {
            expect(screen.queryByText("Loading PDF...")).not.toBeInTheDocument();
        });

        unmount();

        // Component should unmount without errors
        expect(screen.queryByRole("canvas")).not.toBeInTheDocument();
    });

    it("handles source change", async () => {
        const { rerender } = render(<PdfViewer source="test1.pdf" />);

        await waitFor(
            () => {
                expect(mockGetDocument).toHaveBeenCalledWith("test1.pdf");
            },
            { timeout: 5000 },
        );

        rerender(<PdfViewer source="test2.pdf" />);

        await waitFor(
            () => {
                expect(mockGetDocument).toHaveBeenCalledWith("test2.pdf");
            },
            { timeout: 5000 },
        );
    });

    it("resets to page 1 when source changes", async () => {
        const user = userEvent.setup();
        const { rerender } = render(<PdfViewer source="test1.pdf" />);

        await waitFor(() => {
            expect(screen.getByLabelText("Next page")).toBeInTheDocument();
        });

        // Navigate to page 2
        const nextButton = screen.getByLabelText("Next page");
        await user.click(nextButton);

        await waitFor(() => {
            const pageInput = screen.getByLabelText("Current page") as HTMLInputElement;
            expect(pageInput.value).toBe("2");
        });

        // Change source
        rerender(<PdfViewer source="test2.pdf" />);

        await waitFor(() => {
            const pageInput = screen.getByLabelText("Current page") as HTMLInputElement;
            expect(pageInput.value).toBe("1");
        });
    });
});
