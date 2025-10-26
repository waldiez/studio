/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
/* eslint-disable max-statements */
import { useTheme } from "@/theme/hook";
import type { PDFDocumentProxy } from "pdfjs-dist";
import "pdfjs-dist/web/pdf_viewer.css";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
    source: string | ArrayBuffer | Uint8Array;
    className?: string;
    initialScale?: number;
    minScale?: number;
    maxScale?: number;
};

let workerConfigured = false;

export default function PdfViewer({
    source,
    className,
    initialScale = 1,
    minScale = 0.5,
    maxScale = 3,
}: Props) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const textLayerRef = useRef<HTMLDivElement | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [numPages, setNumPages] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [scale, setScale] = useState<number>(initialScale);
    const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
    const theme = useTheme().theme;
    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (typeof window === "undefined" || workerConfigured) {
                return;
            }
            const pdfjs = await import("pdfjs-dist");
            pdfjs.GlobalWorkerOptions.workerSrc = new URL(
                "pdfjs-dist/build/pdf.worker.min.mjs",
                import.meta.url,
            ).toString();
            if (!cancelled) {
                workerConfigured = true;
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);
    useEffect(() => {
        let cancelled = false;

        const loadPdf = async () => {
            try {
                setLoading(true);
                setError(null);

                // Determine the source type and load accordingly
                let loadingTask;
                const { getDocument } = await import("pdfjs-dist");
                if (typeof source === "string") {
                    // URL or base64 data
                    loadingTask = getDocument(source);
                } else {
                    // ArrayBuffer or Uint8Array
                    loadingTask = getDocument({ data: source });
                }

                const pdf = await loadingTask.promise;

                if (!cancelled) {
                    setPdfDoc(pdf);
                    setNumPages(pdf.numPages);
                    setCurrentPage(1);
                }
            } catch (err: any) {
                if (!cancelled) {
                    setError(err?.message || "Failed to load PDF");
                    console.error("PDF loading error:", err);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadPdf();

        return () => {
            cancelled = true;
        };
    }, [source]);

    // Render current page
    useEffect(() => {
        if (!pdfDoc || !canvasRef.current) {
            return;
        }

        let cancelled = false;

        const renderPage = async () => {
            try {
                const page = await pdfDoc.getPage(currentPage);
                if (cancelled || !page) {
                    return;
                }

                const scaleForViewport = scale;
                const viewport = page.getViewport({ scale: scaleForViewport });

                const canvas = canvasRef.current!;
                const ctx = canvas.getContext("2d")!;
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                canvas.style.width = `${viewport.width}px`;
                canvas.style.height = `${viewport.height}px`;

                canvas.style.background = theme === "dark" ? "#1a1a1a" : "#ffffff";

                const renderContext = { canvasContext: ctx, viewport } as any;
                await page.render(renderContext).promise;

                // ----- TEXT LAYER -----
                const textLayerDiv = textLayerRef.current;
                const containerDiv = containerRef.current;
                if (textLayerDiv && containerDiv) {
                    // Size/position the overlay to match the canvas/view
                    textLayerDiv.style.width = `${viewport.width}px`;
                    textLayerDiv.style.height = `${viewport.height}px`;

                    // Clear previous text nodes
                    while (textLayerDiv.firstChild) {
                        textLayerDiv.removeChild(textLayerDiv.firstChild);
                    }

                    // Dynamically import pdf.js for the helper
                    const pdfjs = await import("pdfjs-dist");
                    const textContent = page.streamTextContent();
                    const textLayer = new pdfjs.TextLayer({
                        textContentSource: textContent,
                        container: textLayerDiv,
                        viewport,
                    });
                    await textLayer.render();
                    textLayer.update({ viewport });
                    // console.debug(textContent);
                    // Render selectable text
                    // await pdfjs.re
                    //     textContent,
                    //     container: textLayerDiv,
                    //     viewport,
                    //     textDivs: [],
                    //     timeout: 0,
                    //     enhanceTextSelection: true,
                    // }).promise;
                } else {
                    console.debug("No ref?");
                }
            } catch (err: any) {
                if (!cancelled) {
                    setError(err?.message || "Failed to render page");
                    console.error("Page rendering error:", err);
                }
            }
        };

        renderPage();

        return () => {
            cancelled = true;
        };
    }, [pdfDoc, currentPage, scale, theme]);

    // Navigation handlers
    const goToPrevPage = useCallback(() => {
        setCurrentPage(prev => Math.max(1, prev - 1));
    }, []);

    const goToNextPage = useCallback(() => {
        setCurrentPage(prev => Math.min(numPages, prev + 1));
    }, [numPages]);

    const goToPage = useCallback(
        (page: number) => {
            setCurrentPage(Math.max(1, Math.min(numPages, page)));
        },
        [numPages],
    );

    // Zoom handlers
    const zoomIn = useCallback(() => {
        setScale(prev => Math.min(maxScale, prev + 0.25));
    }, [maxScale]);

    const zoomOut = useCallback(() => {
        setScale(prev => Math.max(minScale, prev - 0.25));
    }, [minScale]);

    const resetZoom = useCallback(() => {
        setScale(initialScale);
    }, [initialScale]);

    return (
        <div className={className ?? "h-full w-full flex flex-col"}>
            {/* Controls */}
            {!loading && !error && pdfDoc && (
                <div className="flex items-center justify-between p-2 border-b border-[var(--border-color)] bg-[var(--background-secondary)]">
                    {/* Page navigation */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={goToPrevPage}
                            disabled={currentPage <= 1}
                            className="px-2 py-1 rounded bg-[var(--button-background)] text-[var(--text-primary)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--button-hover)] transition-colors"
                            aria-label="Previous page"
                        >
                            ←
                        </button>

                        <div className="flex items-center gap-1">
                            <input
                                type="number"
                                min={1}
                                max={numPages}
                                value={currentPage}
                                onChange={e => goToPage(parseInt(e.target.value) || 1)}
                                className="w-12 px-1 py-0.5 text-center border border-[var(--border-color)] rounded bg-[var(--input-background)] text-[var(--text-primary)]"
                                aria-label="Current page"
                            />
                            <span className="text-[var(--text-secondary)]">/ {numPages}</span>
                        </div>

                        <button
                            onClick={goToNextPage}
                            disabled={currentPage >= numPages}
                            className="px-2 py-1 rounded bg-[var(--button-background)] text-[var(--text-primary)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--button-hover)] transition-colors"
                            aria-label="Next page"
                        >
                            →
                        </button>
                    </div>

                    {/* Zoom controls */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={zoomOut}
                            disabled={scale <= minScale}
                            className="px-2 py-1 rounded bg-[var(--button-background)] text-[var(--text-primary)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--button-hover)] transition-colors"
                            aria-label="Zoom out"
                        >
                            −
                        </button>

                        <button
                            onClick={resetZoom}
                            className="px-2 py-1 rounded bg-[var(--button-background)] text-[var(--text-primary)] hover:bg-[var(--button-hover)] transition-colors"
                            aria-label="Reset zoom"
                        >
                            {Math.round(scale * 100)}%
                        </button>

                        <button
                            onClick={zoomIn}
                            disabled={scale >= maxScale}
                            className="px-2 py-1 rounded bg-[var(--button-background)] text-[var(--text-primary)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--button-hover)] transition-colors"
                            aria-label="Zoom in"
                        >
                            +
                        </button>
                    </div>
                </div>
            )}

            {/* Content area */}
            <div className="flex-1 overflow-auto p-4 bg-[var(--background-primary)]">
                {loading && (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-[var(--text-secondary)]">Loading PDF...</div>
                    </div>
                )}

                {error && (
                    <div className="flex items-center justify-center h-full">
                        <pre className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2 overflow-auto max-w-md">
                            PDF Error: {error}
                        </pre>
                    </div>
                )}

                {!loading && !error && (
                    <div className="flex items-center justify-center">
                        <div
                            ref={containerRef}
                            className="relative" // needed so text layer can absolutely position
                            style={{ maxWidth: "100%" }}
                        >
                            <canvas
                                ref={canvasRef}
                                className="shadow-lg"
                                style={{ maxWidth: "100%", height: "auto" }}
                            />
                            <div
                                ref={textLayerRef}
                                className="textLayer absolute inset-0 pointer-events-auto select-text"
                                // pdf.js applies inline styles to children; container just needs to overlay
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
