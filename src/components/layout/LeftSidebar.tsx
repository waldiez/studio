/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import FileExplorer from "@/features/explorer/components/FileExplorer";

export default function LeftSidebar() {
    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <FileExplorer />
            </div>
        </div>
    );
}
