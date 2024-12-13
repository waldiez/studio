import { useEffect, useRef, useState } from 'react';

import { WaldiezProps, importFlow } from '@waldiez/react';

import { uploadFile } from '@waldiez/studio/api/fileBrowserService';
import { convertFlow, getFlowContents, saveFlow } from '@waldiez/studio/api/waldiezFlowService';
import { useFileBrowser } from '@waldiez/studio/components/FileBrowser';
import { showSnackbar } from '@waldiez/studio/components/Snackbar';

type UseWaldiezWrapperType = {
    flowId: string;
    isWaldiez: boolean;
    waldiezProps: Partial<WaldiezProps> | null;
    onRun: (flowString: string) => void;
    onCovert: (flowString: string, to: 'py' | 'ipynb') => void;
    onSave: (flowString: string) => void;
    onUpload: (files: File[]) => Promise<string[]>;
};

export const useWaldiezWrapper: () => UseWaldiezWrapperType = () => {
    const { currentPath, refresh } = useFileBrowser();
    const [flowId, setFlowId] = useState(hashPath(currentPath));
    const [isWaldiez, setIsWaldiez] = useState(currentPath.endsWith('.waldiez'));
    const [waldiezProps, setWaldiezProps] = useState<Partial<WaldiezProps> | null>(null);
    const currentPathRef = useRef(currentPath);

    useEffect(() => {
        if (currentPathRef.current === currentPath && waldiezProps !== null) {
            // make sure no lock is set (leftover from previous snackbar)
            window.localStorage.removeItem(`snackbar-${flowId}.lock`);
            return;
        }
        currentPathRef.current = currentPath;
        const currentFlowId = hashPath(currentPath);
        setFlowId(currentFlowId);
        window.localStorage.removeItem(`snackbar-${currentFlowId}.lock`);
        const isWaldiezFile = currentPath.endsWith('.waldiez');
        setIsWaldiez(isWaldiezFile);
        const getWaldiezProps = async () => {
            setWaldiezProps(null);
            if (isWaldiezFile) {
                const flow = await getFlowContents(currentPath);
                const flowProps = importFlow(flow);
                setWaldiezProps(flowProps);
            }
        };
        getWaldiezProps();
    }, [currentPath]);
    const onRun = (flowString: string) => {
        console.info(flowString);
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
    return {
        flowId,
        isWaldiez,
        waldiezProps,
        onRun,
        onCovert,
        onSave,
        onUpload
    };
};

const hashPath = (path: string): string => {
    let hash = 0;
    for (let i = 0; i < path.length; i++) {
        const char = path.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0; // Convert to 32-bit integer
    }
    return `wf-${Math.abs(hash)}`;
};
