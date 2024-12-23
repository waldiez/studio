import { FlowModal } from "@waldiez/studio/components/FlowModal";
import "@waldiez/studio/components/WaldiezWrapper/WaldiezWrapper.css";
import { useWaldiezWrapper } from "@waldiez/studio/components/WaldiezWrapper/useWaldiezWrapper";

import { useEffect } from "react";

import { Waldiez } from "@waldiez/react";

const vsPath = "monaco/vs";
const inputPrompt = null;
const onUserInput = null;

export const WaldiezWrapper = () => {
    const {
        flowId,
        isWaldiez,
        waldiezProps,
        messages,
        prompt,
        fileName,
        isModalOpen,
        sendMessage,
        resetPrompt,
        onRun,
        onCovert,
        onChange,
        onSave,
        setModalOpen,
        onUpload,
    } = useWaldiezWrapper();
    const handleRun = (flowString: string) => {
        onRun(flowString);
    };
    const onSubmit = (input: string) => {
        resetPrompt();
        sendMessage({ action: "input", payload: input });
    };
    const closeModal = () => {
        setModalOpen(false);
    };
    useEffect(() => {
        if (prompt !== null) {
            setModalOpen(true);
        }
    }, [prompt]);
    return isWaldiez ? (
        waldiezProps ? (
            <>
                <Waldiez
                    {...waldiezProps}
                    flowId={flowId}
                    storageId={flowId}
                    inputPrompt={inputPrompt}
                    monacoVsPath={vsPath}
                    onUserInput={onUserInput}
                    onRun={handleRun}
                    onChange={onChange}
                    onUpload={onUpload}
                    onSave={onSave}
                    onConvert={onCovert}
                />
                <FlowModal
                    isOpen={isModalOpen}
                    onClose={closeModal}
                    messages={messages}
                    onSubmit={onSubmit}
                    prompt={prompt}
                    title={fileName}
                />
            </>
        ) : (
            <div className="waldiez-wrapper-no-flow">
                <p data-testid="waldiez-loading-flow">Loading flow...</p>
            </div>
        )
    ) : (
        <div className="waldiez-wrapper-no-flow">
            <p data-testid="waldiez-no-flow">
                Create a new file or select an existing <span>.waldiez</span> file to start
            </p>
        </div>
    );
};
