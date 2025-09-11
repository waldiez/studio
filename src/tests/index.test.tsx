/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { startApp } from "@/index";
import { afterEach, beforeEach, it, vi } from "vitest";

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
    });
    afterEach(() => {
        vi.resetAllMocks();
    });

    it("should start the app", () => {
        const rootDiv = document.createElement("div");
        rootDiv.id = "root";
        document.body.appendChild(rootDiv);
        startApp();
    });
});
