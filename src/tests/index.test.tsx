/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
import { startApp } from "@/index";
import { afterEach, beforeEach, it, vi } from "vitest";

let getItemSpy: any;
let setItemSpy: any;

describe("index", () => {
    beforeEach(() => {
        // mock 'ReactDOM.createRoot(document.getElementById('root')!).render(...'
        vi.mock("react-dom/client", () => ({
            default: {
                createRoot: () => ({
                    render: vi.fn(),
                }),
            },
        }));
        Object.defineProperty(window, "localStorage", {
            value: {
                getItem: vi.fn(() => null),
                setItem: vi.fn(),
                removeItem: vi.fn(),
                clear: vi.fn(),
            },
            writable: true,
            configurable: true,
        });

        getItemSpy = vi.spyOn(window.localStorage, "getItem");
        setItemSpy = vi.spyOn(window.localStorage, "setItem");
    });
    afterEach(() => {
        getItemSpy.mockRestore();
        setItemSpy.mockRestore();
        vi.resetAllMocks();
    });

    it("should start the app", () => {
        const rootDiv = document.createElement("div");
        rootDiv.id = "root";
        document.body.appendChild(rootDiv);
        startApp();
    });
});
