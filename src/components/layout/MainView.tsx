/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import ViewerRouter from "@/features/viewers/components/ViewerRouter";
import { saveTextFile } from "@/lib/http";
import { useWorkspace } from "@/store/workspace";

import { useCallback, useEffect, useMemo, useRef } from "react";

export default function MainView() {
    const { selected, fileCache } = useWorkspace();

    const data = selected ? fileCache[selected.path] : undefined;

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
            if (!selected) {
                return;
            }
            const filePath = `/${selected.path}`;
            await saveTextFile(filePath, value);
            // useDrafts.getState().clearDraft(filePath)}, []);
            // optionally toast “Saved”
        },
        [selected],
    );

    useEffect(() => {
        return () => {
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
            }
        };
    }, []);

    if (!selected) {
        return (
            <div className="flex flex-col h-full items-center justify-center text-center">
                <div className="text-sm opacity-70">Select a file from the Explorer.</div>
            </div>
        );
    }
    if (!data) {
        return (
            <div className="flex flex-col h-full items-center justify-center text-center">
                <div className="text-sm opacity-70">Loading...</div>
            </div>
        );
    }

    return (
        <div className="h-full w-full">
            <ViewerRouter
                name={selected.name}
                mime={(data as any).mime}
                path={`/${selected.path}`}
                data={
                    data.kind === "text"
                        ? { kind: "text", content: data.content }
                        : { kind: "binary", mime: data.mime, url: binaryUrl! }
                }
                onSaveText={onSave}
                // onChangeText={(next) => ...save draft to store...}
            />
        </div>
    );
}
