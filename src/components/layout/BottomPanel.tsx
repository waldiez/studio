/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ConsolePane from "@/features/execution/components/ConsolePane";
import { useFileSystem } from "@/features/explorer/hooks/useFileSystem";
import Terminal from "@/features/terminal/components/Terminal";

import * as React from "react";

type BottomPanelProps = {
    /** Content shown in the “Run” tab (e.g., <ConsolePane />) */
    runPane?: React.ReactNode;
    /** Content shown in the “Terminal” tab (e.g., <Terminal />) */
    terminalPane?: React.ReactNode;
    /** Default active tab */
    defaultTab?: string;
    /** Optional controlled value + onChange if we want to drive it from a store */
    value?: string;
    onValueChange?: (v: string) => void;
    className?: string;
};

export default function BottomPanel({ className, defaultTab, value, onValueChange }: BottomPanelProps) {
    const [internal, setInternal] = React.useState<string>(defaultTab || "terminal");
    const fs = useFileSystem();
    const controlled = value !== undefined;
    const active = controlled ? value : internal;
    const setActive = (next: string) => {
        if (controlled) {
            onValueChange?.(next);
        } else {
            setInternal(next);
        }
    };
    return (
        <div className={className ?? "h-full w-full flex flex-col bg-[var(--background-color)]"}>
            <Tabs value={active} onValueChange={setActive} className="h-full flex flex-col">
                {/* Top bar */}
                <div className="h-9 flex items-center">
                    <TabsList className="h-8 bg-transparent text-[var(--text-color)] border-b border-[var(--border-color)] rounded-none p-0">
                        <TabsTrigger
                            value="terminal"
                            className="
                                px-3 h-8 rounded-none border-none shadow-none
                                text-sm opacity-80
                                data-[state=active]:opacity-100
                                data-[state=active]:text-[var(--primary-color)]
                                data-[state=active]:border-b
                                data-[state=active]:border-b-[var(--primary-color)]
                            "
                        >
                            TERMINAL
                        </TabsTrigger>
                        <TabsTrigger
                            value="output"
                            className="
                                px-3 h-8 rounded-none border-none shadow-none
                                text-sm opacity-80
                                data-[state=active]:opacity-100
                                data-[state=active]:text-[var(--primary-color)]
                                data-[state=active]:border-b
                                data-[state=active]:border-b-[var(--primary-color)]
                            "
                        >
                            OUTPUT
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* Content area */}
                <div className="flex-1 min-h-0">
                    <TabsContent value="terminal" className="m-0 h-full data-[state=inactive]:hidden">
                        <div className="h-full min-h-0">
                            <Terminal cwd={fs.cwd} />
                        </div>
                    </TabsContent>
                    <TabsContent value="output" className="m-0 h-full data-[state=inactive]:hidden">
                        <div className="h-full min-h-0">
                            <ConsolePane />
                        </div>
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
