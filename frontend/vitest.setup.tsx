/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, vi } from "vitest";

vi.mock("axios", async importOriginal => {
    const actualAxios = await importOriginal<typeof import("axios")>();
    const mockedAxios = {
        ...actualAxios,
        create: vi.fn(() => {
            const instance = {
                get: vi.fn(),
                post: vi.fn(),
                put: vi.fn(),
                delete: vi.fn(),
                request: vi.fn(),
                interceptors: {
                    request: { use: vi.fn(), eject: vi.fn() },
                    response: {
                        use: vi.fn((_onFulfilled, onRejected) => {
                            instance._onRejected = onRejected; // Capture the rejection handler for testing.
                        }),
                        eject: vi.fn(),
                    },
                },
                defaults: { headers: {} },
                _onRejected: null, // Placeholder for the rejection handler.
            };
            return instance;
        }),
    };
    return {
        ...mockedAxios,
        default: { ...mockedAxios },
    };
});

export class ResizeObserver {
    callback: globalThis.ResizeObserverCallback;

    constructor(callback: globalThis.ResizeObserverCallback) {
        this.callback = callback;
    }

    observe(target: Element) {
        this.callback([{ target } as globalThis.ResizeObserverEntry], this);
    }

    unobserve() {}

    disconnect() {}
}

export class DOMMatrixReadOnly {
    m22: number;
    constructor(transform: string) {
        const scale = transform?.match(/scale\(([1-9.])\)/)?.[1];
        this.m22 = scale !== undefined ? +scale : 1;
    }
}
// Only run the shim once when requested
let init = false;

export const mockReactFlow = () => {
    if (init) {
        return;
    }
    init = true;

    global.ResizeObserver = ResizeObserver;

    /* eslint-disable @typescript-eslint/ban-ts-comment */
    // @ts-ignore
    global.DOMMatrixReadOnly = DOMMatrixReadOnly;

    Object.defineProperties(global.HTMLElement.prototype, {
        offsetHeight: {
            get() {
                return parseFloat(this.style.height) || 1;
            },
        },
        offsetWidth: {
            get() {
                return parseFloat(this.style.width) || 1;
            },
        },
    });

    (global.SVGElement as any).prototype.getBBox = () => ({
        x: 10,
        y: 10,
        width: 30,
        height: 30,
    });
};

beforeEach(() => {
    mockReactFlow();
    vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
});
beforeAll(() => {
    global.ResizeObserver = ResizeObserver;
    window.URL.createObjectURL = vi.fn();
    window.URL.revokeObjectURL = vi.fn();
});
afterAll(() => {
    vi.resetAllMocks();
});
