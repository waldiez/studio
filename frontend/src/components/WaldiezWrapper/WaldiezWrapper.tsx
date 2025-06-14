/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { Waldiez } from "@waldiez/react";
import "@waldiez/studio/components/WaldiezWrapper/WaldiezWrapper.css";
import { useWaldiezWrapper } from "@waldiez/studio/components/WaldiezWrapper/useWaldiezWrapper";

const vsPath = "/monaco/vs";

export const WaldiezWrapper = () => {
    const { flowId, isWaldiez, waldiezProps, chat, onRun, onConvert, onChange, onSave, onUpload } =
        useWaldiezWrapper();
    return isWaldiez ? (
        waldiezProps ? (
            <Waldiez
                {...waldiezProps}
                flowId={flowId}
                storageId={flowId}
                monacoVsPath={vsPath}
                chat={chat}
                onRun={onRun}
                onChange={onChange}
                onUpload={onUpload}
                onSave={onSave}
                onConvert={onConvert}
            />
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
