/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
export type ExecEvent =
    | { type: "run_status"; data: { state: string; pid?: number; cwd?: string } }
    | { type: "run_stdout"; data: { text: string } }
    | { type: "run_stderr"; data: { text: string } }
    | { type: "cell_start"; data: { index: number } }
    | { type: "cell_end"; data: { index: number; status: string } }
    | { type: "cell_output"; data: { mime: string; text?: string; b64?: string } }
    | { type: "input_request"; data: { prompt: string; password: boolean } }
    | { type: "kernel_status"; data: { execution_state: string } }
    | { type: "compile_start"; data: { source: string } }
    | { type: "compile_end"; data: { py: string } }
    | { type: "compile_error"; data: { message: string } }
    | { type: "run_end"; data: { status: string; returnCode?: number; elapsedMs?: number } }
    | { type: "error"; data: { message: string } }
    | { [key: string]: any };
