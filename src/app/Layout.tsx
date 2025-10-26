/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import TitleBar from "@/components/layout/TitleBar";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { type RunMode, emitRunRequested, emitRunStopRequested } from "@/lib/events";
import { useExec } from "@/store/exec";
import { useLayout } from "@/store/layout";
import { useWorkspace } from "@/store/workspace";
import { isRunnable } from "@/utils/paths";

import { useRef } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";

export default function Layout({
    left,
    main,
    bottom,
}: {
    left: React.ReactNode;
    main: React.ReactNode;
    bottom: React.ReactNode;
}) {
    const {
        hSizes,
        vSizes,
        setHorizontal,
        setVertical,
        leftCollapsed,
        bottomCollapsed,
        setLeftCollapsed,
        setBottomCollapsed,
    } = useLayout();
    const { running, taskPath, startedAt } = useExec();
    const activeTab = useWorkspace(s => s.getActiveTab());
    const currentPath = taskPath ?? activeTab?.item.path ?? null;
    const runnable = isRunnable(activeTab?.item.path);

    // refs to control collapse/expand programmatically
    const leftRef = useRef<ImperativePanelHandle | null>(null);
    const bottomRef = useRef<ImperativePanelHandle | null>(null);

    const handleRun = (mode: RunMode = "chat") => {
        if (!currentPath) {
            return;
        }
        emitRunRequested({ path: currentPath, mode });
    };

    const handleStop = () => emitRunStopRequested();

    // keep store booleans in sync when sizes change
    /* c8 ignore next -- @preserve */
    const onHorizontalLayout = (sizes: number[]) => {
        setHorizontal(sizes);
        const isLeftCollapsed = (sizes[0] ?? 0) <= 0.2;
        if (isLeftCollapsed !== leftCollapsed) {
            setLeftCollapsed(isLeftCollapsed);
        }
    };
    /* c8 ignore next -- @preserve */
    const onVerticalLayout = (sizes: number[]) => {
        setVertical(sizes);
        const isBottomCollapsed = (sizes[1] ?? 0) <= 0.2;
        if (isBottomCollapsed !== bottomCollapsed) {
            setBottomCollapsed(isBottomCollapsed);
        }
    };

    /* c8 ignore next -- @preserve */
    const toggleSidebar = () => {
        const api = leftRef.current;
        if (!api) {
            return;
        }
        api.isCollapsed() ? api.expand() : api.collapse();
    };
    /* c8 ignore next -- @preserve */
    const toggleDock = () => {
        const api = bottomRef.current;
        if (!api) {
            return;
        }
        api.isCollapsed() ? api.expand() : api.collapse();
    };

    return (
        <div className="h-[var(--app-height)] w-[var(--app-width)] flex flex-col bg-[var(--background-color)] text-[var(--text-color)]">
            <TitleBar
                running={running}
                startedAt={startedAt}
                runnable={runnable}
                currentPath={currentPath}
                onRun={() => handleRun("chat")}
                onStop={() => handleStop()}
                // onStep={() => handleRun("step"))}
                onToggleSidebar={toggleSidebar}
                onToggleDock={toggleDock}
                skipThemeToggle
            />
            <ResizablePanelGroup
                direction="horizontal"
                className="flex-1 min-h-0"
                onLayout={onHorizontalLayout}
            >
                {/* LEFT SIDEBAR */}
                <ResizablePanel
                    ref={leftRef}
                    defaultSize={hSizes[0]}
                    minSize={3}
                    collapsible
                    collapsedSize={0}
                    className="border-r border-[var(--border-color)] bg-[var(--primary-alt-color)] min-w-0 data-[collapsed=true]:border-0"
                >
                    {left}
                </ResizablePanel>
                {!leftCollapsed && <ResizableHandle withHandle />}

                {/* RIGHT SIDE: MAIN + DOCK */}
                <ResizablePanel defaultSize={hSizes[1]} minSize={30}>
                    <ResizablePanelGroup direction="vertical" className="h-full" onLayout={onVerticalLayout}>
                        <ResizablePanel defaultSize={vSizes[0]} minSize={30} className="min-h-[160px]">
                            {main}
                        </ResizablePanel>
                        {!bottomCollapsed && <ResizableHandle withHandle />}
                        <ResizablePanel
                            ref={bottomRef}
                            defaultSize={vSizes[1]}
                            minSize={20}
                            collapsible
                            collapsedSize={0}
                            className="border-t border-[var(--border-color)] bg-[var(--primary-alt-color)] min-h-0 data-[collapsed=true]:border-0"
                        >
                            {bottom}
                        </ResizablePanel>
                    </ResizablePanelGroup>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}
