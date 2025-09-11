/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { useExec } from "@/store/exec";

import { useEffect, useRef } from "react";

export default function ConsolePane() {
    const { lines } = useExec();
    const endRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [lines]);

    return (
        <div className="h-full w-full font-mono text-sm overflow-auto p-2">
            {lines.map((l, i) => (
                <pre
                    key={i}
                    className={
                        l.kind === "stderr"
                            ? "text-[var(--ansi-red)]"
                            : l.kind === "system"
                              ? "opacity-70"
                              : ""
                    }
                >
                    {l.text}
                </pre>
            ))}
            <div ref={endRef} />
        </div>
    );
}
