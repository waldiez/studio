/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import FileExplorer from "@/features/explorer/components/FileExplorer";
import { useWorkspace } from "@/store/workspace";
import type { PathItem } from "@/types/api";

import { useCallback } from "react";

export default function LeftSidebar() {
    const select = useWorkspace(s => s.select);

    const onOpenFile = useCallback(
        (it: PathItem) => {
            if (it.type === "file") {
                void select(it);
            }
        },
        [select],
    );
    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <FileExplorer onOpenFile={onOpenFile} />
            </div>
        </div>
    );
}
