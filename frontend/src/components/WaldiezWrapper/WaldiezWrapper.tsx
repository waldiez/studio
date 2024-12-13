import { Waldiez } from '@waldiez/react';

import '@waldiez/studio/components/WaldiezWrapper/WaldiezWrapper.css';
import { useWaldiezWrapper } from '@waldiez/studio/components/WaldiezWrapper/useWaldiezWrapper';

const vsPath = 'monaco/vs';

const onChange = null;
const inputPrompt = null;
const onUserInput = null;

export const WaldiezWrapper = () => {
    const { flowId, isWaldiez, waldiezProps, onRun, onCovert, onSave, onUpload } = useWaldiezWrapper();
    return isWaldiez ? (
        waldiezProps ? (
            <Waldiez
                {...waldiezProps}
                flowId={flowId}
                storageId={flowId}
                inputPrompt={inputPrompt}
                monacoVsPath={vsPath}
                onUserInput={onUserInput}
                onRun={onRun}
                onChange={onChange}
                onUpload={onUpload}
                onSave={onSave}
                onConvert={onCovert}
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
