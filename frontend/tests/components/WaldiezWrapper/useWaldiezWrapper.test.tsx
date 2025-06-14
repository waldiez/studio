/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import useWebSocket from "react-use-websocket";

import * as waldiezReact from "@waldiez/react";
import * as fileBrowserService from "@waldiez/studio/api/fileBrowserService";
import * as waldiezFlowService from "@waldiez/studio/api/waldiezFlowService";
import * as fileBrowser from "@waldiez/studio/components/FileBrowser";
import { useWaldiezWrapper } from "@waldiez/studio/components/WaldiezWrapper/useWaldiezWrapper";
import * as debounceUtil from "@waldiez/studio/utils/debounce";
import * as hashPathUtil from "@waldiez/studio/utils/hashPath";

// Mock dependencies
vi.mock("react-use-websocket");
vi.mock("@waldiez/react");
vi.mock("@waldiez/studio/api/fileBrowserService");
vi.mock("@waldiez/studio/api/waldiezFlowService");
vi.mock("@waldiez/studio/components/FileBrowser");
vi.mock("@waldiez/studio/utils/debounce");
vi.mock("@waldiez/studio/utils/hashPath");

describe("useWaldiezWrapper Hook", () => {
    const mockSendJsonMessage = vi.fn();
    const mockShowSnackbar = vi.fn();
    const mockGetFlowContents = vi.fn();
    const mockSaveFlow = vi.fn();
    const mockConvertFlow = vi.fn();
    const mockUploadFile = vi.fn();
    const mockRefresh = vi.fn();
    const mockOnGoUp = vi.fn();
    const mockImportFlow = vi.fn();
    const mockUseFileBrowser = vi.fn();
    const mockDebounce = vi.fn();
    const mockHashPath = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup mocks with proper typing
        vi.mocked(useWebSocket).mockReturnValue({
            sendJsonMessage: mockSendJsonMessage,
            lastMessage: null,
            readyState: 1,
            getWebSocket: vi.fn(),
            sendMessage: vi.fn(),
            lastJsonMessage: null,
        });

        vi.mocked(waldiezReact.showSnackbar).mockImplementation(mockShowSnackbar);
        vi.mocked(waldiezReact.importFlow).mockImplementation(
            mockImportFlow.mockReturnValue({
                flowId: "test-flow-id",
                name: "Test Flow",
            }),
        );
        vi.mocked(waldiezReact.WaldiezChatMessageProcessor.process).mockReturnValue({
            message: {
                id: "1",
                timestamp: new Date().toISOString(),
                type: "system",
                content: [{ type: "text", text: "Test message" }],
            },
        });

        vi.mocked(waldiezFlowService.getFlowContents).mockImplementation(
            mockGetFlowContents.mockResolvedValue('{"nodes": []}'),
        );
        vi.mocked(waldiezFlowService.saveFlow).mockImplementation(mockSaveFlow.mockResolvedValue({}));
        vi.mocked(waldiezFlowService.convertFlow).mockImplementation(mockConvertFlow.mockResolvedValue({}));

        vi.mocked(fileBrowserService.uploadFile).mockImplementation(
            mockUploadFile.mockResolvedValue({ path: "/uploaded/file.txt" }),
        );

        vi.mocked(fileBrowser.useFileBrowser).mockImplementation(
            mockUseFileBrowser.mockReturnValue({
                currentPath: "/",
                pathName: "root",
                refresh: mockRefresh,
                onGoUp: mockOnGoUp,
            }),
        );

        vi.mocked(debounceUtil.debounce).mockImplementation(mockDebounce.mockImplementation(fn => fn));
        vi.mocked(hashPathUtil.hashPath).mockImplementation(mockHashPath.mockReturnValue("test-hash"));
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("initializes with non-waldiez path", () => {
            const { result } = renderHook(() => useWaldiezWrapper());

            expect(result.current.isWaldiez).toBe(false);
            expect(result.current.waldiezProps).toBe(null);
            expect(result.current.flowId).toBe("test-hash");
            expect(result.current.fileName).toBe("root");
            expect(result.current.status).toBe(null);
        });

        it("initializes with waldiez path", async () => {
            mockUseFileBrowser.mockReturnValue({
                currentPath: "/test.waldiez",
                pathName: "test.waldiez",
                refresh: mockRefresh,
                onGoUp: mockOnGoUp,
            });

            const { result } = renderHook(() => useWaldiezWrapper());

            expect(result.current.isWaldiez).toBe(true);

            await waitFor(() => {
                expect(result.current.waldiezProps).not.toBe(null);
            });

            expect(mockGetFlowContents).toHaveBeenCalledWith("/test.waldiez");
            expect(mockImportFlow).toHaveBeenCalled();
        });
    });

    describe("path navigation", () => {
        it("resets state when navigating from waldiez to non-waldiez file", async () => {
            mockUseFileBrowser.mockReturnValue({
                currentPath: "/test.waldiez",
                pathName: "test.waldiez",
                refresh: mockRefresh,
                onGoUp: mockOnGoUp,
            });

            const { result, rerender } = renderHook(() => useWaldiezWrapper());

            await waitFor(() => {
                expect(result.current.waldiezProps).not.toBe(null);
            });

            mockUseFileBrowser.mockReturnValue({
                currentPath: "/test.txt",
                pathName: "test.txt",
                refresh: mockRefresh,
                onGoUp: mockOnGoUp,
            });

            rerender();

            expect(result.current.isWaldiez).toBe(false);
            expect(result.current.waldiezProps).toBe(null);
            expect(result.current.chat?.showUI).toBe(false);
            expect(result.current.chat?.messages).toEqual([]);
        });

        it("handles error when loading waldiez props fails", async () => {
            mockGetFlowContents.mockRejectedValueOnce({ status: 404, message: "Not found" });

            mockUseFileBrowser.mockReturnValue({
                currentPath: "/test.waldiez",
                pathName: "test.waldiez",
                refresh: mockRefresh,
                onGoUp: mockOnGoUp,
            });

            renderHook(() => useWaldiezWrapper());

            await waitFor(() => {
                expect(mockShowSnackbar).toHaveBeenCalledWith({
                    flowId: "test-hash",
                    message: "Failed to load the flow",
                    level: "error",
                    details: "Not found",
                    duration: 5000,
                    withCloseButton: true,
                });
                expect(mockOnGoUp).toHaveBeenCalled();
            });
        });
    });

    describe("flow operations", () => {
        it("handles onSave successfully", async () => {
            const { result } = renderHook(() => useWaldiezWrapper());

            await act(async () => {
                await result.current.onSave("test flow content");
            });

            expect(mockSaveFlow).toHaveBeenCalledWith("/", "test flow content");
            expect(mockShowSnackbar).toHaveBeenCalledWith({
                flowId: "test-hash",
                message: "Flow saved successfully",
                level: "success",
            });
            expect(mockRefresh).toHaveBeenCalled();
        });

        it("handles onSave error", async () => {
            mockSaveFlow.mockRejectedValueOnce(new Error("Save failed"));

            const { result } = renderHook(() => useWaldiezWrapper());

            await act(async () => {
                await result.current.onSave("test flow content");
            });

            expect(mockShowSnackbar).toHaveBeenCalledWith({
                flowId: "test-hash",
                message: "Failed to save the flow",
                level: "error",
                details: "Save failed",
            });
        });

        it("handles onConvert successfully", async () => {
            const { result } = renderHook(() => useWaldiezWrapper());

            await act(async () => {
                await result.current.onConvert("test flow", "py");
            });

            expect(mockConvertFlow).toHaveBeenCalledWith("/", "test flow", "py");
            expect(mockRefresh).toHaveBeenCalled();
        });

        it("handles onConvert error", async () => {
            mockConvertFlow.mockRejectedValueOnce(new Error("Conversion failed"));

            const { result } = renderHook(() => useWaldiezWrapper());

            await act(async () => {
                await result.current.onConvert("test flow", "ipynb");
            });

            expect(mockShowSnackbar).toHaveBeenCalledWith({
                flowId: "test-hash",
                message: "Flow conversion failed",
                level: "error",
                details: "Conversion failed",
            });
        });

        it("handles onChange with debounced save", () => {
            const { result } = renderHook(() => useWaldiezWrapper());

            act(() => {
                result.current.onChange("test flow content");
            });

            expect(mockSaveFlow).toHaveBeenCalledWith("/", "test flow content");
        });
    });

    describe("file upload", () => {
        it("handles file upload successfully", async () => {
            const testFile = new File(["test content"], "test.txt", { type: "text/plain" });

            const { result } = renderHook(() => useWaldiezWrapper());

            let uploadResult;
            await act(async () => {
                uploadResult = await result.current.onUpload([testFile]);
            });

            expect(uploadResult).toEqual(["/uploaded/file.txt"]);
            expect(mockUploadFile).toHaveBeenCalledWith("/", testFile);
            expect(mockRefresh).toHaveBeenCalled();
        });

        it("handles file upload from waldiez directory", async () => {
            mockUseFileBrowser.mockReturnValue({
                currentPath: "/folder/test.waldiez",
                pathName: "test.waldiez",
                refresh: mockRefresh,
                onGoUp: mockOnGoUp,
            });

            const testFile = new File(["test content"], "test.txt", { type: "text/plain" });
            const { result } = renderHook(() => useWaldiezWrapper());

            await act(async () => {
                await result.current.onUpload([testFile]);
            });

            expect(mockUploadFile).toHaveBeenCalledWith("/folder", testFile);
        });

        it("handles file upload error", async () => {
            mockUploadFile.mockRejectedValueOnce(new Error("Upload failed"));

            const testFile = new File(["test content"], "test.txt", { type: "text/plain" });
            const { result } = renderHook(() => useWaldiezWrapper());

            await act(async () => {
                await result.current.onUpload([testFile]);
            });

            expect(mockShowSnackbar).toHaveBeenCalledWith({
                flowId: "test-hash",
                message: "Failed to upload the file",
                level: "error",
                details: "Upload failed",
            });
        });
    });

    describe("chat functionality", () => {
        it("initializes chat config correctly", () => {
            const { result } = renderHook(() => useWaldiezWrapper());

            expect(result.current.chat).toEqual({
                showUI: false,
                messages: [],
                userParticipants: [],
                activeRequest: undefined,
                handlers: {
                    onInterrupt: expect.any(Function),
                    onUserInput: expect.any(Function),
                },
            });
        });

        it("can reset chat config manually", () => {
            const { result } = renderHook(() => useWaldiezWrapper());

            act(() => {
                const currentChat = result.current.chat!;
                result.current.chat = {
                    ...currentChat,
                    messages: [
                        {
                            id: "1",
                            timestamp: new Date().toISOString(),
                            type: "system",
                            content: [{ type: "text", text: "existing message" }],
                        },
                    ],
                    userParticipants: ["user1"],
                    showUI: true,
                };
            });

            expect(result.current.chat?.messages).toHaveLength(1);
            expect(result.current.chat?.showUI).toBe(true);

            act(() => {
                const handlers = result.current.chat!.handlers;
                result.current.chat = {
                    showUI: false,
                    messages: [],
                    userParticipants: [],
                    activeRequest: undefined,
                    handlers,
                };
            });

            expect(result.current.chat?.messages).toEqual([]);
            expect(result.current.chat?.showUI).toBe(false);
            expect(result.current.chat?.userParticipants).toEqual([]);
        });
    });

    describe("WebSocket URL generation", () => {
        beforeEach(() => {
            Object.defineProperty(window, "location", {
                value: { origin: "http://localhost:3000" },
                configurable: true,
            });
        });

        it("generates correct WebSocket URL for waldiez files", () => {
            mockUseFileBrowser.mockReturnValue({
                currentPath: "/test.waldiez",
                pathName: "test.waldiez",
                refresh: mockRefresh,
                onGoUp: mockOnGoUp,
            });

            renderHook(() => useWaldiezWrapper());

            expect(useWebSocket).toHaveBeenCalledWith(
                "ws://localhost:3000/ws?path=/test.waldiez",
                expect.any(Object),
                true,
            );
        });

        it("returns null WebSocket URL for non-waldiez files", () => {
            mockUseFileBrowser.mockReturnValue({
                currentPath: "/test.txt",
                pathName: "test.txt",
                refresh: mockRefresh,
                onGoUp: mockOnGoUp,
            });

            renderHook(() => useWaldiezWrapper());

            expect(useWebSocket).toHaveBeenCalledWith(null, expect.any(Object), false);
        });

        it("handles https to wss conversion", () => {
            Object.defineProperty(window, "location", {
                value: { origin: "https://example.com" },
                configurable: true,
            });

            mockUseFileBrowser.mockReturnValue({
                currentPath: "/test.waldiez",
                pathName: "test.waldiez",
                refresh: mockRefresh,
                onGoUp: mockOnGoUp,
            });

            renderHook(() => useWaldiezWrapper());

            expect(useWebSocket).toHaveBeenCalledWith(
                "wss://example.com/ws?path=/test.waldiez",
                expect.any(Object),
                true,
            );
        });
    });

    describe("WebSocket message handling", () => {
        it("calls sendMessage correctly", () => {
            const { result } = renderHook(() => useWaldiezWrapper());

            act(() => {
                result.current.sendMessage({ test: "message" });
            });

            expect(mockSendJsonMessage).toHaveBeenCalledWith({ test: "message" });
        });

        it("handles WebSocket errors", () => {
            mockUseFileBrowser.mockReturnValue({
                currentPath: "/test.waldiez",
                pathName: "test.waldiez",
                refresh: mockRefresh,
                onGoUp: mockOnGoUp,
            });

            renderHook(() => useWaldiezWrapper());

            const useWebSocketCall = vi.mocked(useWebSocket).mock.calls[0];
            const options = useWebSocketCall[1];
            const onError = options!.onError;

            const errorEvent = new ErrorEvent("error", { message: "Connection failed" });
            onError!(errorEvent);

            expect(mockShowSnackbar).toHaveBeenCalledWith({
                flowId: "test-hash",
                message: "WebSocket error",
                level: "error",
                details: "Connection failed",
                duration: 3000,
            });
        });

        it("handles WebSocket close with error code", () => {
            mockUseFileBrowser.mockReturnValue({
                currentPath: "/test.waldiez",
                pathName: "test.waldiez",
                refresh: mockRefresh,
                onGoUp: mockOnGoUp,
            });

            renderHook(() => useWaldiezWrapper());

            const useWebSocketCall = vi.mocked(useWebSocket).mock.calls[0];
            const options = useWebSocketCall[1];
            const onClose = options!.onClose;

            const closeEvent = new CloseEvent("close", {
                code: 1002,
                reason: "Protocol error",
                wasClean: false,
            });
            onClose!(closeEvent);

            expect(mockShowSnackbar).toHaveBeenCalledWith({
                flowId: "test-hash",
                message: "WebSocket closed",
                level: "error",
                details: "Protocol error",
                duration: 3000,
            });
        });

        it("handles WebSocket close with acceptable code", () => {
            mockUseFileBrowser.mockReturnValue({
                currentPath: "/test.waldiez",
                pathName: "test.waldiez",
                refresh: mockRefresh,
                onGoUp: mockOnGoUp,
            });

            renderHook(() => useWaldiezWrapper());

            const useWebSocketCall = vi.mocked(useWebSocket).mock.calls[0];
            const options = useWebSocketCall[1];
            const onClose = options!.onClose;

            const closeEvent = new CloseEvent("close", {
                code: 1000,
                reason: "Normal closure",
                wasClean: true,
            });
            onClose!(closeEvent);

            expect(mockShowSnackbar).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    message: "WebSocket closed",
                }),
            );
        });

        it("handles user input callback", () => {
            mockUseFileBrowser.mockReturnValue({
                currentPath: "/test.waldiez",
                pathName: "test.waldiez",
                refresh: mockRefresh,
                onGoUp: mockOnGoUp,
            });

            const { result } = renderHook(() => useWaldiezWrapper());

            act(() => {
                result.current.chat!.handlers!.onUserInput!({
                    id: "req-123",
                    type: "input_response",
                    timestamp: new Date().toISOString(),
                    request_id: "req-123",
                    data: "user response",
                });
            });

            expect(mockSendJsonMessage).toHaveBeenCalledWith({
                type: "input_response",
                request_id: "req-123",
                data: "user response",
            });
        });

        it("handles stop callback", () => {
            mockUseFileBrowser.mockReturnValue({
                currentPath: "/test.waldiez",
                pathName: "test.waldiez",
                refresh: mockRefresh,
                onGoUp: mockOnGoUp,
            });

            const { result } = renderHook(() => useWaldiezWrapper());

            act(() => {
                const currentChat = result.current.chat!;
                result.current.chat = {
                    ...currentChat,
                    messages: [
                        {
                            id: "1",
                            timestamp: new Date().toISOString(),
                            type: "system",
                            content: [{ type: "text", text: "test" }],
                        },
                    ],
                    showUI: true,
                };
            });

            act(() => {
                result.current.chat!.handlers!.onInterrupt!();
            });

            expect(mockSendJsonMessage).toHaveBeenCalledWith({ action: "stop" });
            expect(result.current.status).toBe("COMPLETED");
            expect(result.current.chat?.showUI).toBe(false);
        });
    });

    describe("error scenarios", () => {
        it("handles non-404 error when loading waldiez props", async () => {
            mockGetFlowContents.mockRejectedValueOnce({ status: 500, message: "Server error" });

            mockUseFileBrowser.mockReturnValue({
                currentPath: "/test.waldiez",
                pathName: "test.waldiez",
                refresh: mockRefresh,
                onGoUp: mockOnGoUp,
            });

            renderHook(() => useWaldiezWrapper());

            await waitFor(() => {
                expect(mockGetFlowContents).toHaveBeenCalled();
            });

            expect(mockOnGoUp).not.toHaveBeenCalled();
        });
    });
});
