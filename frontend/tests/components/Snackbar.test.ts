import { waitFor } from "@testing-library/react";
import { showSnackbar } from "@waldiez/studio/components/Snackbar";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Snackbar", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        localStorage.clear();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.restoreAllMocks();
    });

    it("should display a snackbar with correct message, level, and details", () => {
        const flowId = "test-flow";
        const message = "Test message";
        const details = "Test details";
        const level = "info";

        showSnackbar(flowId, message, level, details);

        const snackbar = document.querySelector(`#${flowId}-snackbar`);
        expect(snackbar).not.toBeNull();
        expect(snackbar?.textContent).toContain(message);
        expect(snackbar?.textContent).toContain(details);
        expect(snackbar?.className).toContain("snackbar");
        expect(snackbar?.className).toContain(level);
    });

    it("should lock and unlock the snackbar correctly", () => {
        const flowId = "test-flow";
        const message = "Lock test message";
        const duration = 3000;
        // Ensure the localStorage is initially empty
        expect(localStorage.getItem(`snackbar-${flowId}.lock`)).toBeNull();
        // Show snackbar and check if it's locked
        showSnackbar(flowId, message, "info", null, duration);
        expect(localStorage.getItem(`snackbar-${flowId}.lock`)).toBe("1");
        // Simulate time passing to unlock the snackbar
        vi.advanceTimersByTime(duration);
        expect(localStorage.getItem(`snackbar-${flowId}.lock`)).toBeNull();
    });

    it("should add a close button when no duration is provided", () => {
        const flowId = "test-flow";
        const message = "Test message without duration";

        showSnackbar(flowId, message, "info", null, undefined);

        const snackbar = document.querySelector(`#${flowId}-snackbar`);
        const closeButton = snackbar?.querySelector(".close");

        expect(closeButton).not.toBeNull();
        (closeButton as HTMLElement).click();

        vi.advanceTimersByTime(300);

        expect(document.querySelector(`#${flowId}-snackbar`)).toBeNull();
    });

    it("should allow manual closing via the close button", () => {
        const flowId = "test-flow";
        const message = "Test message";

        showSnackbar(flowId, message);

        const closeButton = document.querySelector(`#${flowId}-snackbar .close`) as HTMLElement;
        expect(closeButton).not.toBeNull();

        closeButton.click();
        waitFor(() => {
            expect(document.querySelector(`#${flowId}-snackbar`)).toBeNull();
        });
    });

    it("should reuse existing snackbar element for the same flowId", () => {
        const flowId = "test-flow";
        const message1 = "Message 1";
        const message2 = "Message 2";

        showSnackbar(flowId, message1);
        const snackbar = document.querySelector(`#${flowId}-snackbar`);

        expect(snackbar).not.toBeNull();
        expect(snackbar?.textContent).toContain(message1);

        showSnackbar(flowId, message2);
        const updatedSnackbar = document.querySelector(`#${flowId}-snackbar`);

        expect(updatedSnackbar).toBe(snackbar);
        expect(updatedSnackbar?.textContent).toContain(message2);
    });

    it("should render details as collapsible content", () => {
        const flowId = "test-flow";
        const message = "Test message";
        const details = "Detailed information";

        showSnackbar(flowId, message, "info", details);

        const detailsElement = document.querySelector(`#${flowId}-snackbar details`);
        expect(detailsElement).not.toBeNull();

        const summary = detailsElement?.querySelector("summary");
        expect(summary?.textContent).toBe("Details");
        expect(detailsElement?.textContent).toContain(details);
    });

    it("should auto-dismiss snackbar after the specified duration", () => {
        const flowId = "test-flow";
        const message = "Auto-dismiss message";
        const duration = 5000;

        showSnackbar(flowId, message, "info", null, duration);

        const snackbar = document.querySelector(`#${flowId}-snackbar`);
        expect(snackbar).not.toBeNull();

        vi.advanceTimersByTime(duration);
        expect(document.querySelector(`#${flowId}-snackbar`)).toBeNull();
    });

    it("should handle Error objects in details", () => {
        const flowId = "test-flow";
        const message = "Error test message";
        const error = new Error("Error details");

        showSnackbar(flowId, message, "error", error);

        const detailsElement = document.querySelector(`#${flowId}-snackbar details`);
        expect(detailsElement).not.toBeNull();
        expect(detailsElement?.textContent).toContain("Error details");
    });

    it("should handle unexpected errors gracefully", () => {
        const flowId = "test-flow";
        const message = "Unexpected error";
        const invalidError = { unexpected: "error" };

        showSnackbar(flowId, message, "error", invalidError as any);

        const detailsElement = document.querySelector(`#${flowId}-snackbar details`);
        expect(detailsElement).not.toBeNull();
        expect(detailsElement?.textContent).toContain("An unexpected error occurred.");
    });

    it("should retry showing snackbar if it is locked", () => {
        const flowId = "test-flow";
        const message = "Retry message";
        const lockKey = `snackbar-${flowId}.lock`;
        localStorage.setItem(lockKey, "1");
        showSnackbar(flowId, message);
        expect(document.querySelector(`#${flowId}-snackbar`)).toBeNull();
        vi.advanceTimersByTime(100);
        localStorage.removeItem(lockKey);
        vi.advanceTimersByTime(100);
        expect(document.querySelector(`#${flowId}-snackbar`)).not.toBeNull();
    });
});
