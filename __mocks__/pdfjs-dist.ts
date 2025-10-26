/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { vi } from "vitest";

// Create mock objects that will be shared across tests
export const mockPdfDoc = {
    numPages: 3,
    getPage: vi.fn(),
};

export const mockPage = {
    getViewport: vi.fn(() => ({
        width: 800,
        height: 1000,
        scale: 1,
    })),
    render: vi.fn(() => ({
        promise: Promise.resolve(),
    })),
    streamTextContent: vi.fn(() => Promise.resolve([])),
};

export const mockTextLayer = {
    render: vi.fn(() => Promise.resolve()),
    update: vi.fn(),
};

export const mockGetDocument = vi.fn(() => ({
    promise: Promise.resolve(mockPdfDoc),
}));

// Export the mock implementation
export const GlobalWorkerOptions = {
    workerSrc: "",
};

export const getDocument = mockGetDocument;

export class TextLayer {
    constructor() {
        return mockTextLayer;
    }
}

// Default export (for dynamic imports)
export default {
    GlobalWorkerOptions,
    getDocument: mockGetDocument,
    TextLayer,
};
