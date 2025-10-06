/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import TabBar from "@/components/layout/TabBar";
import ViewerRouter from "@/features/viewers/components/ViewerRouter";
import { saveTextFile } from "@/lib/http";
import { useWorkspace } from "@/store/workspace";

import { useCallback, useEffect, useMemo, useRef } from "react";

export default function MainView() {
    const { getActiveTab, fileCache } = useWorkspace();
    const activeTab = getActiveTab();

    const data = activeTab ? fileCache[activeTab.item.path] : undefined;

    // manage objectURL for binary blobs
    const objectUrlRef = useRef<string | null>(null);
    const binaryUrl = useMemo(() => {
        if (!data || data.kind !== "binary") {
            return undefined;
        }
        if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
        }
        if (data.url) {
            objectUrlRef.current = data.url;
        }
        if (data.blob) {
            objectUrlRef.current = URL.createObjectURL(data.blob);
        }
        return objectUrlRef.current;
    }, [data]);

    const onSave = useCallback(
        async (value: string) => {
            if (!activeTab) {
                return;
            }
            const filePath = `/${activeTab.item.path}`;
            await saveTextFile(filePath, value);
            // useDrafts.getState().clearDraft(filePath)
            // optionally toast "Saved"
        },
        [activeTab],
    );

    useEffect(() => {
        return () => {
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
            }
        };
    }, []);

    return (
        <div className="h-full w-full flex flex-col">
            {/* Tab Bar */}
            <TabBar />

            {/* Content Area */}
            <div className="flex-1 min-h-0">
                {!activeTab ? (
                    <div className="flex flex-col h-full items-center justify-center text-center">
                        <div className="text-sm opacity-70">Select a file from the Explorer.</div>
                    </div>
                ) : !data ? (
                    <div className="flex flex-col h-full items-center justify-center text-center">
                        <div className="text-sm opacity-70">Loading...</div>
                    </div>
                ) : (
                    <ViewerRouter
                        name={activeTab.item.name}
                        mime={(data as any).mime}
                        path={`/${activeTab.item.path}`}
                        data={
                            data.kind === "text"
                                ? { kind: "text", content: data.content }
                                : { kind: "binary", mime: data.mime, url: binaryUrl! }
                        }
                        onSaveText={onSave}
                        // onChangeText={(next) => ...save draft to store...}
                    />
                )}
            </div>
        </div>
    );
}
