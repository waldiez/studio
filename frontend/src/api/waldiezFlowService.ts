/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import axiosInstance from "@waldiez/studio/api/axiosInstance";
import { PathInstance } from "@waldiez/studio/types";

/**
 * Get the contents of a flow.
 * @param path - The path of the flow.
 * @returns A promise resolving to the contents of the flow.
 */
export const getFlowContents: (path: string) => Promise<string> = async path => {
    const response = await axiosInstance.get("/flow", {
        params: { path },
    });
    return response.data;
};
/**
 * Save a flow to a file.
 * @param path - The path of the flow.
 * @param flow - The flow to save.
 * @returns A promise resolving to the path of the saved file.
 */
export const saveFlow: (path: string, flow: string) => Promise<PathInstance> = async (path, flow) => {
    const response = await axiosInstance.post(
        "/flow",
        {
            contents: flow,
        },
        {
            params: { path },
        },
    );
    return response.data;
};

/**
 * Convert a flow to .py or .ipynb.
 * @param path - The path of the flow.
 * @param flow - The flow contents.
 * @param to - The target format to convert to.
 * @returns A promise resolving to the path of the converted file.
 */
export const convertFlow: (path: string, flow: string, to: "py" | "ipynb") => Promise<PathInstance> = async (
    path,
    flow,
    to,
) => {
    await saveFlow(path, flow);
    const response = await axiosInstance.post("/flow/export", null, {
        params: {
            path,
            extension: to,
        },
    });
    return response.data;
};
