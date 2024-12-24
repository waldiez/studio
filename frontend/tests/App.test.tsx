import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { App } from "@waldiez/studio/App";

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
describe("App", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        document.body.className = "";
    });

    it('should add "waldiez-dark" if no initial body class and prefers dark mode', async () => {
        mockMatchMedia(true); // Simulate dark mode preference

        await act(async () => {
            render(<App />);
        });

        await waitFor(() => {
            expect(document.body.classList.contains("waldiez-dark")).toBe(true);
        });
    });

    it('should add "waldiez-light" if no initial body class and prefers light mode', async () => {
        mockMatchMedia(false); // Simulate light mode preference

        await act(async () => {
            render(<App />);
        });

        await waitFor(() => {
            expect(document.body.classList.contains("waldiez-light")).toBe(true);
        });
    });

    it("should not overwrite body class if already set", async () => {
        mockMatchMedia(false); // Simulate light mode
        document.body.classList.add("waldiez-dark"); // Simulate existing dark mode class

        await act(async () => {
            render(<App />);
        });

        expect(document.body.classList.contains("waldiez-dark")).toBe(true);
        expect(document.body.classList.contains("waldiez-light")).toBe(false);
    });
});
