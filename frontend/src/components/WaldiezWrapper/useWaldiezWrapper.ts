import { useEffect, useRef, useState } from 'react';
import useWebSocket from 'react-use-websocket';

import { WaldiezProps, importFlow } from '@waldiez/react';

import { uploadFile } from '@waldiez/studio/api/fileBrowserService';
import { convertFlow, getFlowContents, saveFlow } from '@waldiez/studio/api/waldiezFlowService';
import { useFileBrowser } from '@waldiez/studio/components/FileBrowser';
import { showSnackbar } from '@waldiez/studio/components/Snackbar';
import { hashPath } from '@waldiez/studio/utils/hashPath';

type UseWaldiezWrapperType = {
    flowId: string;
    status: string | null;
    isWaldiez: boolean;
    waldiezProps: Partial<WaldiezProps> | null;
    messages: string[];
    prompt: string | null;
    fileName: string;
    isModalOpen: boolean;
    setModalOpen: (isOpen: boolean) => void;
    resetPrompt: () => void;
    onRun: (flowString: string) => Promise<void>;
    onCovert: (flowString: string, to: 'py' | 'ipynb') => void;
    onSave: (flowString: string) => void;
    onUpload: (files: File[]) => Promise<string[]>;
    sendMessage: (message: any) => void;
};

export const useWaldiezWrapper: () => UseWaldiezWrapperType = () => {
    const { currentPath, pathName, refresh, onGoUp } = useFileBrowser();
    const [flowId, setFlowId] = useState(hashPath(currentPath));
    const statusRef = useRef<string | null>(null);
    const promptRef = useRef<string | null>(null);
    const [isModalOpen, setModalOpen] = useState(false);
    const [flowMessages, setFlowMessages] = useState<string[]>([]);
    const [isWaldiez, setIsWaldiez] = useState(currentPath.endsWith('.waldiez'));
    const [waldiezProps, setWaldiezProps] = useState<Partial<WaldiezProps> | null>(null);
    const currentPathRef = useRef(currentPath);
    const currentPathNameRef = useRef(pathName);
    const getWaldiezProps = async (isWaldiezFile: boolean) => {
        setWaldiezProps(null);
        if (isWaldiezFile) {
            try {
                const flow = await getFlowContents(currentPath);
                const flowProps = importFlow(flow);
                setWaldiezProps(flowProps);
            } catch (error: any) {
                if (error?.status === 404) {
                    showSnackbar(flowId, 'Failed to load the flow', 'error', error.message);
                    onGoUp();
                }
            }
        }
    };
    useEffect(() => {
        if (currentPathRef.current === currentPath && waldiezProps !== null) {
            // make sure no lock is set (leftover from previous snackbar)
            window.localStorage.removeItem(`snackbar-${flowId}.lock`);
            return;
        }
        currentPathRef.current = currentPath;
        currentPathNameRef.current = pathName;
        const currentFlowId = hashPath(currentPath);
        setFlowId(currentFlowId);
        window.localStorage.removeItem(`snackbar-${currentFlowId}.lock`);
        const isWaldiezFile = currentPath.endsWith('.waldiez');
        setIsWaldiez(isWaldiezFile);
        getWaldiezProps(isWaldiezFile);
    }, [currentPath]);
    const onPrint = (data: any) => {
        setFlowMessages(prevMessages => [...prevMessages, data]);
        try {
            const parsedData = JSON.parse(data);
            if (parsedData.type === 'error') {
                const details = parsedData.data?.details ?? undefined;
                const message = parsedData.data?.message ?? 'Error running task';
                showSnackbar(flowId, message, 'error', details);
            }
        } catch (_) {
            // do nothing
        }
    };
    const onInput = (data: any) => {
        if (typeof data === 'string') {
            promptRef.current = data;
        }
    };
    const onResults = (data: any) => {
        refresh()
            .then(() => {
                showSnackbar(flowId, 'Flow execution completed', 'success');
            })
            .catch((error: any) => {
                showSnackbar(flowId, 'Failed to refresh the file browser', 'error', error.message);
            })
            .finally(() => {
                onStatus(null);
                const dataString =
                    typeof data === 'string' ? data : JSON.stringify({ results: data }, null, 2);
                setFlowMessages(prevMessages => [...prevMessages, dataString]);
            });
    };
    const onStatus = (data: any) => {
        if (typeof data === 'string' || data === null) {
            statusRef.current = data;
        }
    };
    const triggerSnackbar = (type: 'info' | 'success' | 'warning' | 'error', data: any) => {
        if (type === 'error') {
            showSnackbar(flowId, 'Flow execution failed', 'error', data.message);
        } else {
            showSnackbar(flowId, data, type, null, 5000, true);
        }
    };
    const onMessage = (message: MessageEvent) => {
        let massageObject = {};
        try {
            massageObject = JSON.parse(message.data);
        } catch (_) {
            return;
        }
        if ('type' in massageObject && 'data' in massageObject) {
            const { type, data } = massageObject;
            switch (type) {
                case 'print':
                    onPrint(data);
                    break;
                case 'input':
                    onInput(data);
                    break;
                case 'error':
                case 'info':
                case 'warning':
                    triggerSnackbar(type, data);
                    break;
                case 'results':
                    onResults(data);
                    break;
                case 'status':
                    onStatus(data);
                    break;
                default:
                    break;
            }
        }
    };
    const onWsError = () => {
        showSnackbar(flowId, 'WebSocket error', 'error', undefined, 3000);
    };
    const onWsClose = (event: CloseEvent) => {
        const acceptableCodes = [1000, 1001, 1005, 1006];
        if (!acceptableCodes.includes(event.code)) {
            let errorMsg = event.reason;
            if (!errorMsg) {
                errorMsg = JSON.stringify({
                    code: event.code,
                    wasClean: event.wasClean,
                    reason: event.reason
                });
            }
            showSnackbar(flowId, 'WebSocket closed', 'error', errorMsg, 3000);
        }
    };
    const wsUrl = isWaldiez ? window.location.origin.replace('http', 'ws') + `/ws?path=${currentPath}` : null;
    const { sendJsonMessage } = useWebSocket(wsUrl, {
        reconnectInterval: 3000,
        reconnectAttempts: 10,
        retryOnError: true,
        onError: onWsError,
        onClose: onWsClose,
        onMessage,
        shouldReconnect: () => isWaldiez
    });
    const checkStatus = () => {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout while waiting for status'));
            }, 5000);
            const currentStatus = statusRef.current;
            const interval = setInterval(() => {
                if (currentStatus !== statusRef.current || statusRef.current === 'COMPLETED') {
                    clearInterval(interval);
                    clearTimeout(timeout);
                    resolve(statusRef.current);
                }
            }, 100);
        });
    };
    const onRun = async (flowString: string) => {
        statusRef.current = null;
        sendJsonMessage({ action: 'status' });
        try {
            const currentStatus = await checkStatus();
            if (currentStatus === 'NOT_STARTED' || currentStatus === 'COMPLETED') {
                await onSave(flowString);
                setFlowMessages(['Starting the flow...']);
                setModalOpen(true);
                sendJsonMessage({ action: 'start' });
            } else {
                showSnackbar(flowId, 'Flow is already running', 'info');
            }
        } catch (error: any) {
            showSnackbar(flowId, 'Failed to start the flow', 'error', error.message);
        }
    };
    const onCovert = async (flow: string, to: 'py' | 'ipynb') => {
        try {
            await convertFlow(currentPathRef.current, flow, to);
            await refresh();
        } catch (error: any) {
            console.error(error);
            showSnackbar(flowId, 'Flow conversion failed', 'error', error.message);
        }
    };
    const onSave = async (flowString: string) => {
        try {
            await saveFlow(currentPathRef.current, flowString);
            await refresh();
        } catch (error: any) {
            console.error(error);
            showSnackbar(flowId, 'Failed to save the flow', 'error', error.message);
        }
    };
    const onUpload = (files: File[]) => {
        return new Promise<string[]>(resolve => {
            const uploadedFiles: string[] = [];
            const promises = files.map(async file => {
                const response = await uploadFile(currentPathRef.current, file);
                uploadedFiles.push(response.path);
            });
            Promise.all(promises).then(() => {
                resolve(uploadedFiles);
            });
        });
    };
    const resetPrompt = () => {
        promptRef.current = null;
    };
    return {
        flowId,
        isWaldiez,
        waldiezProps,
        status: statusRef.current,
        messages: flowMessages,
        prompt: promptRef.current,
        fileName: currentPathNameRef.current,
        isModalOpen,
        setModalOpen,
        resetPrompt,
        onRun,
        onCovert,
        onSave,
        onUpload,
        sendMessage: sendJsonMessage
    };
};
