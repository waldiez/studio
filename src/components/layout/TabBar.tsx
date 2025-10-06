/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileIcon } from "@/components/ui/fileIcon";
import { cn } from "@/lib/utils";
import { useDrafts } from "@/store/drafts";
import { useWorkspace } from "@/store/workspace";
import { MoreHorizontal, Pin, X } from "lucide-react";

import { useMemo } from "react";

export default function TabBar() {
    const { openTabs, activeTabId, closeTab, setActiveTab, pinTab, unpinTab, closeAllTabs, closeOtherTabs } =
        useWorkspace();
    const { getDraft } = useDrafts();

    const tabs = useMemo(() => {
        return openTabs.map(tab => {
            const draft = getDraft(`/${tab.item.path}`);
            const dirty = draft !== undefined;
            return { ...tab, isDirty: dirty };
        });
    }, [openTabs, getDraft]);

    if (openTabs.length === 0) {
        return null;
    }

    return (
        <div className="flex items-center border-b border-[var(--border-color)] bg-[var(--primary-alt-color)] overflow-x-auto overflow-y-hidden h-10 px-1">
            <div className="flex items-center gap-0.5 min-w-0 flex-1">
                {tabs.map(tab => {
                    const isActive = tab.id === activeTabId;
                    return (
                        <div
                            key={`tab-${tab.id}`}
                            className={cn(
                                "group relative flex items-center gap-1.5 px-3 py-1.5 rounded-t border-b-2 transition-colors cursor-pointer select-none min-w-0 max-w-[200px]",
                                isActive
                                    ? "bg-[var(--background-color)] border-[var(--accent-color)] text-[var(--text-color)]"
                                    : "bg-transparent border-transparent hover:bg-[var(--background-color)]/50 text-[var(--text-color)]/70",
                            )}
                            onClick={() => setActiveTab(tab.id)}
                            onContextMenu={e => {
                                e.preventDefault();
                                // Could show context menu here
                            }}
                        >
                            {/* File Icon */}
                            <FileIcon name={tab.item.name} className="w-4 h-4 shrink-0" />

                            {/* Pin Indicator */}
                            {tab.isPinned && <Pin className="w-3 h-3 shrink-0 opacity-60" />}

                            {/* File Name */}
                            <span className="truncate text-sm font-medium">{tab.item.name}</span>

                            {/* Dirty Indicator */}
                            {tab.isDirty && (
                                <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)] shrink-0" />
                            )}

                            {/* Close Button */}
                            <button
                                className={cn(
                                    "shrink-0 p-0.5 rounded hover:bg-[var(--border-color)] transition-colors",
                                    !isActive && "opacity-0 group-hover:opacity-100",
                                )}
                                onClick={e => {
                                    e.stopPropagation();
                                    closeTab(tab.id);
                                }}
                                aria-label="Close tab"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Tab Actions Menu */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="shrink-0 h-7 w-7 p-0 ml-1">
                        <MoreHorizontal className="w-4 h-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem
                        onClick={() => activeTabId && closeOtherTabs(activeTabId)}
                        disabled={openTabs.length <= 1}
                    >
                        Close Other Tabs
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={closeAllTabs}>Close All Tabs</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={() => activeTabId && pinTab(activeTabId)}
                        disabled={!activeTabId || openTabs.find(t => t.id === activeTabId)?.isPinned}
                    >
                        Pin Tab
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => activeTabId && unpinTab(activeTabId)}
                        disabled={!activeTabId || !openTabs.find(t => t.id === activeTabId)?.isPinned}
                    >
                        Unpin Tab
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
