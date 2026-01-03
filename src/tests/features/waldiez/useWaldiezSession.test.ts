/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
import { useWaldiezSession } from "@/features/waldiez/useWaldiezSession";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/lib/axiosInstance", () => ({
    default: { post: vi.fn() },
}));

vi.mock("@/lib/events", () => ({
    emitWorkspaceChanged: vi.fn(),
}));

vi.mock("@/utils/deepMerge", () => ({
    deepMerge: (a: any, b: any) => ({ ...a, ...b }),
}));

vi.mock("@/utils/paths", () => ({
    dirname: (path: string) => path.split("/").slice(0, -1).join("/"),
}));

// Create mock controller class
const mockStart = vi.fn();
const mockStop = vi.fn();

vi.mock("@/features/waldiez/controller", () => {
    const WaldiezController = vi.fn(
        class WaldiezController {
            constructor(onState: any) {
                return {
                    start: mockStart,
                    stop: mockStop,
                    onState,
                };
            }
        },
    );
    return { WaldiezController };
});

describe("useWaldiezSession", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns initial state", () => {
        const { result } = renderHook(() => useWaldiezSession("/test/flow.waldiez"));

        expect(result.current.state.chat.show).toBe(false);
        expect(result.current.state.stepByStep.show).toBe(false);
        expect(result.current.actions.run).toBeInstanceOf(Function);
        expect(result.current.actions.stepRun).toBeInstanceOf(Function);
    });

    it("provides run action", () => {
        const { result } = renderHook(() => useWaldiezSession("/test/flow.waldiez"));

        act(() => {
            result.current.actions.run();
        });

        expect(mockStart).toHaveBeenCalledWith("/test/flow.waldiez", { mode: "chat" });
    });

    it("provides stepRun action", () => {
        const { result } = renderHook(() => useWaldiezSession("/test/flow.waldiez"));

        act(() => {
            result.current.actions.stepRun();
        });

        expect(mockStart).toHaveBeenCalledWith("/test/flow.waldiez", { mode: "step" });
    });

    it("provides stepRun action with breakpoints", () => {
        const { result } = renderHook(() => useWaldiezSession("/test/flow.waldiez"));

        act(() => {
            result.current.actions.stepRun(undefined, ["event:run_completion"]);
        });

        expect(mockStart).toHaveBeenCalledWith("/test/flow.waldiez", {
            mode: "step",
            args: ["--breakpoints", "event:run_completion"],
        });
    });

    it("handles null path", () => {
        const { result } = renderHook(() => useWaldiezSession(null));

        act(() => {
            result.current.actions.run();
            result.current.actions.stepRun();
        });

        expect(mockStart).not.toHaveBeenCalled();
    });

    it("stops controller on path change", () => {
        const { rerender } = renderHook(({ path }) => useWaldiezSession(path), {
            initialProps: { path: "/test/flow1.waldiez" },
        });

        rerender({ path: "/test/flow2.waldiez" });

        expect(mockStop).toHaveBeenCalled();
    });

    it("cleans up on unmount", () => {
        const { unmount } = renderHook(() => useWaldiezSession("/test/flow.waldiez"));

        unmount();

        expect(mockStop).toHaveBeenCalled();
    });
    it("actions.save posts contents to /flow with path param", async () => {
        const axios = (await import("@/lib/axiosInstance")).default as unknown as {
            post: ReturnType<typeof vi.fn>;
        };
        axios.post.mockResolvedValue({});

        const { result } = renderHook(() => useWaldiezSession("/test/flow.waldiez"));

        await act(async () => {
            await result.current.actions.save("print('hi')");
        });

        expect(axios.post).toHaveBeenCalledWith(
            "/flow",
            { contents: "print('hi')" },
            { params: { path: "/test/flow.waldiez" } },
        );
    });

    it("actions.save is a no-op when path is null", async () => {
        const axios = (await import("@/lib/axiosInstance")).default as unknown as {
            post: ReturnType<typeof vi.fn>;
        };
        axios.post.mockResolvedValue({});

        const { result } = renderHook(() => useWaldiezSession(null));

        await act(async () => {
            await result.current.actions.save("anything");
        });

        expect(axios.post).not.toHaveBeenCalled();
    });

    it("actions.convert('py') saves first, then exports, then emits workspace changed", async () => {
        const axios = (await import("@/lib/axiosInstance")).default as unknown as {
            post: ReturnType<typeof vi.fn>;
        };
        const events = await import("@/lib/events");
        (events.emitWorkspaceChanged as unknown as ReturnType<typeof vi.fn>).mockClear();

        // make axios.post resolve
        axios.post.mockResolvedValue({});

        const { result } = renderHook(() => useWaldiezSession("/test/flow.waldiez"));

        await act(async () => {
            await result.current.actions.convert("flow-contents-here", "py");
        });

        // Call order: save -> export
        expect(axios.post).toHaveBeenNthCalledWith(
            1,
            "/flow",
            { contents: "flow-contents-here" },
            { params: { path: "/test/flow.waldiez" } },
        );
        expect(axios.post).toHaveBeenNthCalledWith(2, "/flow/export", null, {
            params: { path: "/test/flow.waldiez", extension: "py" },
        });

        // dirname mock returns "/test", and the code prefixes another "/"
        // so parent is expected to be "//test"
        expect(events.emitWorkspaceChanged).toHaveBeenCalledWith({ parent: "//test" });
    });

    it("actions.convert is a no-op when path is null", async () => {
        const axios = (await import("@/lib/axiosInstance")).default as unknown as {
            post: ReturnType<typeof vi.fn>;
        };
        const events = await import("@/lib/events");
        axios.post.mockResolvedValue({});

        const { result } = renderHook(() => useWaldiezSession(null));

        await act(async () => {
            await result.current.actions.convert("x", "ipynb");
        });

        expect(axios.post).not.toHaveBeenCalled();
        expect(events.emitWorkspaceChanged).not.toHaveBeenCalled();
    });

    it("applies state patches via controller.onState using deepMerge", () => {
        const { result } = renderHook(() => useWaldiezSession("/test/flow.waldiez"));

        // Our mocked controller exposes onState; call it with a patch
        act(() => {
            // turn on chat.show and add a message; deepMerge should merge into existing state
            (result.current.controller as any).onState({
                chat: { show: true, messages: [{ id: "m1", role: "user", content: "hi" }] },
            });
        });

        expect(result.current.state.chat.show).toBe(true);
        expect(result.current.state.chat.messages).toEqual([{ id: "m1", role: "user", content: "hi" }]);
        // unchanged fields remain (e.g., stepByStep.show defaults to false)
        expect(result.current.state.stepByStep.show).toBe(false);
    });
});
