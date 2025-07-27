/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
/* eslint-disable max-lines-per-function, max-lines  */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useWebSocket from "react-use-websocket";

import {
    WaldiezChatConfig,
    WaldiezChatMessageProcessor,
    WaldiezChatUserInput,
    WaldiezProps,
    WaldiezTimelineData,
    importFlow,
    showSnackbar,
} from "@waldiez/react";
import { uploadFile } from "@waldiez/studio/api/fileBrowserService";
import { convertFlow, getFlowContents, saveFlow } from "@waldiez/studio/api/waldiezFlowService";
import { useFileBrowser } from "@waldiez/studio/components/FileBrowser";
import { debounce } from "@waldiez/studio/utils/debounce";
import { hashPath } from "@waldiez/studio/utils/hashPath";

type UseWaldiezWrapperType = {
    flowId: string;
    status: string | null;
    isWaldiez: boolean;
    waldiezProps: Partial<WaldiezProps> | null;
    fileName: string;
    chat?: WaldiezChatConfig;
    onRun: (flowString: string) => Promise<void>;
    onConvert: (flowString: string, to: "py" | "ipynb") => void;
    onSave: (flowString: string) => void;
    onChange: (flowString: string) => void;
    onUpload: (files: File[]) => Promise<string[]>;
    sendMessage: (message: any) => void;
};

export const useWaldiezWrapper: () => UseWaldiezWrapperType = () => {
    const { currentPath, pathName, refresh, onGoUp } = useFileBrowser();
    const [flowId, setFlowId] = useState(hashPath(currentPath));
    const statusRef = useRef<string | null>(null);
    const [isWaldiez, setIsWaldiez] = useState(currentPath.endsWith(".waldiez"));
    const [waldiezProps, setWaldiezProps] = useState<Partial<WaldiezProps> | null>(null);

    const onUserInput = useCallback((input: WaldiezChatUserInput) => {
        sendJsonMessage({
            type: "input_response",
            request_id: input.request_id,
            data: input.data,
        });
        setFlowChatConfig(prevConfig => ({
            ...prevConfig,
            activeRequest: undefined,
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onStop = useCallback(() => {
        // console.debug("Stopping the flow...");
        try {
            sendJsonMessage({ action: "stop" });
        } catch (error: any) {
            showSnackbar({
                flowId,
                message: "Failed to stop the flow",
                level: "error",
                details: error.message,
            });
        } finally {
            statusRef.current = "COMPLETED";
            setFlowChatConfig(prevConfig => ({
                ...prevConfig,
                showUI: false,
                activeRequest: undefined,
                handlers: {
                    ...prevConfig.handlers,
                    onInterrupt: undefined,
                },
            }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [flowId]);

    const [flowChatConfig, setFlowChatConfig] = useState<WaldiezChatConfig>(() => ({
        showUI: false,
        messages: [],
        timeline: undefined,
        userParticipants: [],
        activeRequest: undefined,
        handlers: {
            onInterrupt: onStop,
            onUserInput: onUserInput,
        },
    }));

    const getWaldiezProps = async () => {
        try {
            const flow = await getFlowContents(currentPath);
            const flowProps = importFlow(flow);
            setWaldiezProps(flowProps);
        } catch (error: any) {
            if (error?.status === 404) {
                showSnackbar({
                    flowId: waldiezProps?.flowId || flowId,
                    message: "Failed to load the flow",
                    level: "error",
                    details: error.message,
                    duration: 5000,
                    withCloseButton: true,
                });
                onGoUp();
            }
        }
    };

    useEffect(() => {
        const onPathChange = async () => {
            const currentFlowId = hashPath(currentPath);
            setFlowId(currentFlowId);
            const isCurrentPathWaldiez = currentPath.endsWith(".waldiez");

            // Reset all waldiez-specific state when navigating away from waldiez files
            if (!isCurrentPathWaldiez) {
                setWaldiezProps(null);
                statusRef.current = null;
                // Reset chat config to initial state
                setFlowChatConfig({
                    showUI: false,
                    messages: [],
                    userParticipants: [],
                    activeRequest: undefined,
                    handlers: {
                        onInterrupt: onStop,
                        onUserInput: onUserInput,
                    },
                });
            }

            setIsWaldiez(isCurrentPathWaldiez);

            if (isCurrentPathWaldiez) {
                await getWaldiezProps();
            }
        };
        onPathChange();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPath]);

    // Cleanup effect when component unmounts or waldiez changes
    useEffect(() => {
        return () => {
            if (!isWaldiez) {
                statusRef.current = null;
            }
        };
    }, [isWaldiez]);

    const onStatus = useCallback(
        (data: any) => {
            if (typeof data === "string" || data === null) {
                const previousStatus = statusRef.current;
                statusRef.current = data;

                // Update chat config based on status changes
                if (data === "RUNNING" && previousStatus !== "RUNNING") {
                    // Flow just started running - prepare chat UI
                    setFlowChatConfig(prevConfig => ({
                        ...prevConfig,
                        showUI: false, // Will be shown when first message arrives
                        handlers: {
                            ...prevConfig.handlers,
                            onInterrupt: onStop,
                        },
                    }));
                } else if (data === "COMPLETED" || data === "NOT_STARTED") {
                    // Flow completed or stopped - hide chat UI
                    setFlowChatConfig(prevConfig => ({
                        ...prevConfig,
                        showUI: false,
                        handlers: {
                            ...prevConfig.handlers,
                            onInterrupt: onStop,
                        },
                    }));
                }
            }
        },
        [onStop],
    );

    const parseMessageObject: (message: MessageEvent) => { [key: string]: any } | undefined = message => {
        let messageObject: { [key: string]: any } = {};
        try {
            messageObject = JSON.parse(message.data);
        } catch (_) {
            return;
        }
        // noinspection SuspiciousTypeOfGuard
        if (typeof messageObject === "string") {
            try {
                messageObject = JSON.parse(messageObject);
            } catch (_) {
                //
            }
        }
        if ("data" in messageObject && typeof messageObject.data === "string") {
            try {
                messageObject.data = JSON.parse(messageObject.data);
            } catch (_) {
                //
            }
        }
        if (
            "type" in messageObject &&
            typeof messageObject.type === "string" &&
            messageObject.type === "print" &&
            "data" in messageObject
        ) {
            return messageObject.data;
        }
        return messageObject;
    };

    const handleChatParticipantsUpdate = (messageObject: any) => {
        const { participants } = messageObject;
        console.debug("Setting user participants from message:", participants);
        if (Array.isArray(participants) && participants.length > 0) {
            const userParticipants = participants
                .filter(
                    (participant: any) =>
                        participant.humanInputMode === "ALWAYS" || participant.agentType === "user_proxy",
                )
                .map((p: any) => p.name)
                .filter(Boolean);
            setFlowChatConfig(prevConfig => ({
                ...prevConfig,
                showUI: true,
                userParticipants,
            }));
        }
    };
    const handleMessageContent = useCallback(
        (content: any) => {
            const result = WaldiezChatMessageProcessor.process(JSON.stringify(content));
            console.debug("Processed message content:", result);
            if (!result) {
                return;
            }
            if (result.timeline) {
                handleTimelineUpdate(result.timeline);
                return;
            }
            if (result.message && result.message.type === "input_request") {
                const prompt = result.message.prompt || "Enter your message:";
                const requestId = result.requestId || result.message?.request_id || result.message?.id;
                const password = result.message.password || false;
                setFlowChatConfig(prevConfig => ({
                    ...prevConfig,
                    showUI: true,
                    messages: [...prevConfig.messages, result.message!],
                    activeRequest: {
                        request_id: requestId,
                        prompt,
                        password,
                    },
                }));
                return;
            }
            if (result.message) {
                setFlowChatConfig(prevConfig => ({
                    ...prevConfig,
                    showUI: true,
                    messages: [...prevConfig.messages, result.message!],
                }));
            }
        },
        [setFlowChatConfig],
    );
    const onMessage = useCallback(
        // eslint-disable-next-line max-statements
        (message: MessageEvent) => {
            const messageObject = parseMessageObject(message);
            console.debug("Received message from WebSocket:", messageObject);
            if (!messageObject) {
                // console.warn("Received message is not a valid JSON object:", message.data);
                return;
            }
            // console.debug("Received raw message from WebSocket:", message.data);
            // console.debug("Received message from WebSocket:", messageObject);
            if ("participants" in messageObject) {
                handleChatParticipantsUpdate(messageObject);
                return;
            }
            if (
                "type" in messageObject &&
                typeof messageObject.type === "string" &&
                ("data" in messageObject || "content" in messageObject)
            ) {
                if ("content" in messageObject) {
                    handleMessageContent(messageObject);
                } else if ("data" in messageObject) {
                    if (["status", "results", "error", "info", "warning"].includes(messageObject.type)) {
                        if (messageObject.type === "status") {
                            onStatus(messageObject.data);
                        } else {
                            // eslint-disable-next-line max-depth
                            if (messageObject.type === "results") {
                                onResults();
                            }
                            // eslint-disable-next-line max-depth
                            if (messageObject.type === "error") {
                                onError();
                            } else if (messageObject.type === "info") {
                                onInfo(messageObject.data);
                            } else {
                                console.log(
                                    "Received message of type:",
                                    messageObject.type,
                                    "with data:",
                                    messageObject.data,
                                );
                            }
                        }
                    }
                }
                return;
            }
        },
        [onStatus, handleMessageContent],
    );

    const onError = () => {
        // Handle error if needed
        console.debug("Received error from WebSocket");
        statusRef.current = "COMPLETED";
        setFlowChatConfig(prevConfig => ({
            ...prevConfig,
            showUI: false,
            activeRequest: undefined,
            handlers: {
                ...prevConfig.handlers,
                onInterrupt: undefined, // hide the "stop" button
            },
        }));
    };

    const onInfo = (info: any) => {
        // Handle info if needed
        console.debug("Received info from WebSocket");
        if ("data" in info && info.data === "Task stopped") {
            statusRef.current = "COMPLETED";
        }
        setFlowChatConfig(prevConfig => ({
            ...prevConfig,
            showUI: false,
            activeRequest: undefined,
            handlers: {
                ...prevConfig.handlers,
                onInterrupt: undefined,
            },
        }));
    };

    const onResults = () => {
        // Handle results if needed
        console.debug("Received results from WebSocket");
        statusRef.current = "COMPLETED";
        setFlowChatConfig(prevConfig => ({
            ...prevConfig,
            showUI: false,
            activeRequest: undefined,
            handlers: {
                ...prevConfig.handlers,
                onInterrupt: undefined, // hide the "stop" button
            },
        }));
    };

    const handleTimelineUpdate = (timeline: WaldiezTimelineData) => {
        if (
            !timeline ||
            !timeline.metadata ||
            !timeline.summary ||
            !timeline.agents ||
            !Array.isArray(timeline.agents) ||
            timeline.agents.length === 0 ||
            !timeline.cost_timeline ||
            !Array.isArray(timeline.cost_timeline) ||
            timeline.cost_timeline.length === 0 ||
            !timeline.timeline ||
            !Array.isArray(timeline.timeline) ||
            timeline.timeline.length === 0
        ) {
            console.warn("Received invalid or empty timeline data:", timeline);
            return;
        }
        setFlowChatConfig(prevConfig => ({
            ...prevConfig,
            showUI: false,
            timeline,
        }));
    };

    const onWsError = (event: Event) => {
        showSnackbar({
            flowId,
            message: "WebSocket error",
            level: "error",
            details: (event as ErrorEvent).message || "An error occurred with the WebSocket connection",
            duration: 3000,
        });
    };

    const onWsClose = (event: CloseEvent) => {
        const acceptableCodes = [1000, 1001, 1005, 1006];
        if (!acceptableCodes.includes(event.code)) {
            let errorMsg = event.reason;
            if (!errorMsg) {
                errorMsg = JSON.stringify({
                    code: event.code,
                    wasClean: event.wasClean,
                    reason: event.reason,
                });
            }
            showSnackbar({
                flowId,
                message: "WebSocket closed",
                level: "error",
                details: errorMsg,
                duration: 3000,
            });
        }
    };

    const wsUrl = useMemo(() => {
        if (isWaldiez && currentPath) {
            return window.location.origin.replace("http", "ws") + `/ws?path=${currentPath}`;
        }
        return null;
    }, [isWaldiez, currentPath]);

    const { sendJsonMessage } = useWebSocket(
        wsUrl,
        {
            reconnectInterval: 3000,
            reconnectAttempts: 10,
            retryOnError: isWaldiez,
            onError: onWsError,
            onClose: onWsClose,
            onMessage,
            shouldReconnect: () => Boolean(isWaldiez && currentPath && currentPath.endsWith(".waldiez")),
        },
        isWaldiez && !!currentPath && currentPath.endsWith(".waldiez"), // More explicit condition
    );

    const checkStatus = () => {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("Timeout while waiting for status"));
            }, 5000);
            const currentStatus = statusRef.current;
            const interval = setInterval(() => {
                if (currentStatus !== statusRef.current || statusRef.current === "COMPLETED") {
                    clearInterval(interval);
                    clearTimeout(timeout);
                    resolve(statusRef.current);
                }
            }, 100);
        });
    };

    const onSave = useCallback(
        async (flowString: string) => {
            try {
                await saveFlow(currentPath, flowString);
                showSnackbar({
                    flowId,
                    message: "Flow saved successfully",
                    level: "success",
                });
                await refresh();
            } catch (error: any) {
                console.error(error);
                showSnackbar({
                    flowId,
                    message: "Failed to save the flow",
                    level: "error",
                    details: error.message,
                });
            }
        },
        [currentPath, flowId, refresh],
    );

    const onRun = useCallback(
        async (flowString: string) => {
            setFlowChatConfig(_ => ({
                showUI: false,
                messages: [],
                userParticipants: [],
                activeRequest: undefined,
                handlers: {
                    onInterrupt: onStop,
                    onUserInput: onUserInput,
                },
            }));
            statusRef.current = null;

            sendJsonMessage({ action: "status" });
            try {
                const currentStatus = await checkStatus();
                if (currentStatus === "NOT_STARTED" || currentStatus === "COMPLETED") {
                    await onSave(flowString);
                    sendJsonMessage({ action: "start" });
                } else {
                    showSnackbar({ flowId, message: "Flow is already running", level: "info" });
                }
            } catch (error: any) {
                showSnackbar({
                    flowId,
                    message: "Failed to start the flow",
                    level: "error",
                    details: error.message,
                });
            }
        },
        [sendJsonMessage, onStop, onUserInput, onSave, flowId],
    );

    const onConvert = async (flow: string, to: "py" | "ipynb") => {
        try {
            await convertFlow(currentPath, flow, to);
            await refresh();
        } catch (error: any) {
            console.error(error);
            showSnackbar({
                flowId,
                message: "Flow conversion failed",
                level: "error",
                details: error.message,
            });
        }
    };

    const onChange = (flowString: string) => {
        debounce(async () => {
            try {
                return await saveFlow(currentPath, flowString);
                /* c8 disable next 3 */
            } catch {
                //
            }
        }, 200)();
    };

    const onUpload = (files: File[]) => {
        return new Promise<string[]>(resolve => {
            const uploadedFiles: string[] = [];
            const promises: Promise<void>[] = files.map(async file => {
                let dirToUpload = `${currentPath}`;
                if (isWaldiez) {
                    const pathParts = currentPath.split("/");
                    pathParts.pop();
                    dirToUpload = pathParts.join("/");
                }
                try {
                    const response = await uploadFile(dirToUpload, file);
                    uploadedFiles.push(response.path);
                } catch (error: any) {
                    showSnackbar({
                        flowId,
                        message: "Failed to upload the file",
                        level: "error",
                        details: error.message,
                    });
                } finally {
                    await refresh();
                }
            });
            Promise.all(promises).then(() => {
                resolve(uploadedFiles);
            });
        });
    };

    return {
        flowId,
        isWaldiez,
        waldiezProps,
        status: statusRef.current,
        fileName: pathName,
        chat: flowChatConfig,
        onRun,
        onConvert,
        onSave,
        onChange,
        onUpload,
        sendMessage: sendJsonMessage,
    };
};
