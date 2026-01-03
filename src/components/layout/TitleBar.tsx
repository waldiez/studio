/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/theme/toggle";
import { PanelBottom, PanelsTopLeft, Play, Square } from "lucide-react";

import { useEffect, useMemo, useState } from "react";

function formatElapsed(ms: number) {
    const s = Math.floor(ms / 1000);
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return hh > 0
        ? `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
        : `${mm}:${String(ss).padStart(2, "0")}`;
}
export default function TitleBar({
    running,
    startedAt,
    runnable,
    onRun,
    onStop,
    onToggleSidebar,
    onToggleDock,
    currentPath,
    skipThemeToggle = false,
}: {
    running: boolean;
    startedAt: number | null;
    runnable: boolean;
    onRun?: () => void;
    onStop?: () => void;
    onToggleSidebar?: () => void;
    onToggleDock?: () => void;
    currentPath?: string | null;
    skipThemeToggle?: boolean;
}) {
    const [now, setNow] = useState<number>(Date.now());
    useEffect(() => {
        if (!running || !startedAt) {
            return;
        }
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [running, startedAt]);

    const elapsed = useMemo(() => {
        if (!running || !startedAt) {
            return null;
        }
        return formatElapsed(now - startedAt);
    }, [now, running, startedAt]);

    return (
        <header className="h-12 px-2 flex items-center justify-between border-b border-[var(--border-color)]">
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onToggleSidebar}>
                    <PanelsTopLeft />
                </Button>
                <strong className="mx-2">Waldiez Studio</strong>
                <Button variant="ghost" size="sm" onClick={onToggleDock}>
                    <PanelBottom />
                </Button>
                <div className="text-sm opacity-70 truncate max-w-[40vw]">{currentPath ?? "/"}</div>
            </div>
            <div className="flex items-center gap-2">
                {running ? (
                    <>
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--secondary-color)] opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--secondary-color)]"></span>
                            </span>
                            <span className="text-xs opacity-80">
                                Running{elapsed ? ` · ${elapsed}` : "..."}
                            </span>
                        </div>
                        <Button variant="destructive" size="sm" onClick={onStop} title="Stop">
                            <Square className="mr-1 size-4" /> Stop
                        </Button>
                    </>
                ) : (
                    runnable && (
                        // <Button variant="outline" size="sm" onClick={onRun} title="Run">
                        <Button variant="default" size="sm" onClick={onRun} title="Run">
                            <Play className="mr-1 size-4" /> Run
                        </Button>
                    )
                )}
                {!skipThemeToggle && <ThemeToggle />}
            </div>
        </header>
    );
}
