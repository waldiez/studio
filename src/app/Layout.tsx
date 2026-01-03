/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
import TitleBar from "@/components/layout/TitleBar";
import { type RunMode, emitRunRequested, emitRunStopRequested } from "@/lib/events";
import { useExec } from "@/store/exec";
import { useWorkspace } from "@/store/workspace";
import { isRunnable } from "@/utils/paths";
import { GripHorizontalIcon, GripVerticalIcon } from "lucide-react";

import { useCallback } from "react";
import { Group, Panel, Separator, useDefaultLayout, usePanelRef } from "react-resizable-panels";

const PANEL_SIZES = {
    LEFT: { DEFAULT: 18, MIN: 50 },
    RIGHT: { DEFAULT: 80, MIN: 30 },
    MAIN: { DEFAULT: 70, MIN: 30 },
    BOTTOM: { DEFAULT: 30, MIN: 50 },
} as const;

export default function Layout({
    left,
    main,
    bottom,
}: {
    left: React.ReactNode;
    main: React.ReactNode;
    bottom: React.ReactNode;
}) {
    const { running, taskPath, startedAt } = useExec();
    const activeTab = useWorkspace(s => s.getActiveTab());
    const currentPath = taskPath ?? activeTab?.item.path ?? null;
    const runnable = isRunnable(activeTab?.item.path);
    const { defaultLayout: defaultRootLayout, onLayoutChange: onRootLayoutChange } = useDefaultLayout({
        groupId: "root-panel",
        storage: localStorage,
    });
    const { defaultLayout: defaultRightLayout, onLayoutChange: onRightLayoutChange } = useDefaultLayout({
        groupId: "right-panel",
        storage: localStorage,
    });
    // refs to control collapse/expand programmatically
    const leftRef = usePanelRef();
    const bottomRef = usePanelRef();

    const handleRun = (mode: RunMode = "chat") => {
        if (!currentPath) {
            return;
        }
        emitRunRequested({ path: currentPath, mode });
    };

    const handleStop = () => emitRunStopRequested();

    /* c8 ignore next -- @preserve */
    const toggleSidebar = useCallback(() => {
        const api = leftRef?.current;
        if (!api) {
            return;
        }
        if (api.isCollapsed()) {
            api.expand();
            api.resize(`${PANEL_SIZES.LEFT.DEFAULT}%`);
        } else {
            api.collapse();
        }
    }, [leftRef]);
    /* c8 ignore next -- @preserve */
    const toggleDock = useCallback(() => {
        const api = bottomRef.current;
        if (!api) {
            return;
        }
        if (api.isCollapsed()) {
            api.expand();
            api.resize(`${PANEL_SIZES.BOTTOM.DEFAULT}%`);
        } else {
            api.collapse();
        }
    }, [bottomRef]);
    return (
        <div className="h-(--app-height) w-(--app-width) flex flex-col bg-(--background-color) text-(--text-color)">
            <TitleBar
                running={running}
                startedAt={startedAt}
                runnable={runnable}
                currentPath={currentPath}
                onRun={() => handleRun("chat")}
                onStop={() => handleStop()}
                onToggleSidebar={toggleSidebar}
                onToggleDock={toggleDock}
                skipThemeToggle
            />
            <Group
                id="root-panel"
                orientation="horizontal"
                className="flex-1 min-h-0 flex h-full w-full"
                defaultLayout={defaultRootLayout}
                onLayoutChange={onRootLayoutChange}
            >
                {/* LEFT SIDEBAR */}
                <Panel
                    id="left"
                    panelRef={leftRef}
                    defaultSize={PANEL_SIZES.LEFT.DEFAULT}
                    // onResize={onLeftPanelResize}
                    minSize={PANEL_SIZES.LEFT.MIN}
                    collapsible
                    collapsedSize={0}
                    className="border-r border-(--border-color) bg-(--primary-alt-color) min-w-0 data-[collapsed=true]:border-0 data-[collapsed=true]:overflow-x-hidden"
                >
                    {left}
                </Panel>
                <Separator className="relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-hidden data-[separator='active']:ring-2 data-[separator='active']:ring-blue-500 data-[separator='active']:ring-inset data-[separator='hover']:ring-2 data-[separator='hover']:ring-blue-500 data-[separator='hover']:ring-inset">
                    <div className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border border-border">
                        <GripVerticalIcon className="size-2.5" />
                    </div>
                </Separator>

                {/* RIGHT SIDE: MAIN + DOCK */}
                <Panel minSize={PANEL_SIZES.RIGHT.MIN} id="right" defaultSize={PANEL_SIZES.RIGHT.DEFAULT}>
                    <Group
                        id="right-panel"
                        orientation="vertical"
                        className="flex h-full w-full flex-col"
                        defaultLayout={defaultRightLayout}
                        onLayoutChange={onRightLayoutChange}
                    >
                        <Panel
                            minSize={PANEL_SIZES.MAIN.MIN}
                            defaultSize={PANEL_SIZES.MAIN.DEFAULT}
                            className="min-h-40"
                            id="top"
                        >
                            {main}
                        </Panel>
                        <Separator className="bg-border relative flex items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 focus-visible:outline-hidden h-px w-full after:h-1 after:translate-x-0 after:-translate-y-1/2 data-[separator='active']:ring-2 data-[separator='active']:ring-blue-500 data-[separator='active']:ring-inset data-[separator='hover']:ring-2 data-[separator='hover']:ring-blue-500 data-[separator='hover']:ring-inset">
                            <div className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border border-border">
                                <GripHorizontalIcon className="size-2.5" />
                            </div>
                        </Separator>
                        <Panel
                            id="bottom"
                            panelRef={bottomRef}
                            minSize={PANEL_SIZES.BOTTOM.MIN}
                            defaultSize={PANEL_SIZES.BOTTOM.DEFAULT}
                            collapsible
                            collapsedSize={0}
                            className="border-t border-(--border-color) bg-(--primary-alt-color) min-h-0 data-[collapsed=true]:border-0"
                        >
                            {bottom}
                        </Panel>
                    </Group>
                </Panel>
            </Group>
        </div>
    );
}
