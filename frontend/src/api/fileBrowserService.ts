/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import axiosInstance from "@waldiez/studio/api/axiosInstance";
import type { MessageResponse, PathInstance, PathInstancesResponse } from "@waldiez/studio/types";

const WORKSPACE_PREFIX = "/workspace";

// API Functions
/**
 * Fetch the list of files and folders in a directory.
 *
 * @param parent - The directory path to fetch. Defaults to '/'.
 * @returns A promise resolving to a list of files and folders.
 */
export const fetchFiles = async (parent: string = "/"): Promise<PathInstancesResponse> => {
    const response = await axiosInstance.get<PathInstancesResponse>(WORKSPACE_PREFIX, {
        params: ["", "/"].includes(parent) ? {} : { parent },
    });
    return response.data;
};

/**
 * Create a new folder.
 *
 * @param parent - The parent directory path. Defaults to '/'.
 * @returns A promise resolving to the newly created folder.
 */
export const createFolder = async (parent: string = "/"): Promise<PathInstance> => {
    const response = await axiosInstance.post<PathInstance>(WORKSPACE_PREFIX, {
        type: "folder",
        parent,
    });
    return response.data;
};

/**
 * Create a new file.
 *
 * @param parent - The parent directory path. Defaults to '/'.
 * @returns A promise resolving to the newly created file.
 */
export const createFile = async (parent: string = "/"): Promise<PathInstance> => {
    const response = await axiosInstance.post<PathInstance>(WORKSPACE_PREFIX, {
        type: "file",
        parent,
    });
    return response.data;
};

/**
 * Upload a file.
 *
 * @param path - The parent directory path. Defaults to '/'.
 * @param file - The file to upload.
 * @returns A promise resolving to the uploaded file information.
 */
export const uploadFile = async (path: string = "/", file: File): Promise<PathInstance> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("path", path);

    const response = await axiosInstance.post<PathInstance>(`${WORKSPACE_PREFIX}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
};

/**
 * Delete a file or folder.
 *
 * @param path - The path to the file or folder to delete. Defaults to '/'.
 * @returns A promise resolving to a success message.
 */
export const deleteFileOrFolder = async (path: string = "/"): Promise<MessageResponse> => {
    const pathParam = /* c8 ignore next */ ["", "/"].includes(path)
        ? /* c8 ignore next */ ""
        : `?path=${encodeURIComponent(path)}`;
    const response = await axiosInstance.delete<MessageResponse>(`${WORKSPACE_PREFIX}${pathParam}`);
    return response.data;
};

/**
 * Rename a file or folder.
 *
 * @param oldPath - The current path of the file or folder.
 * @param newPath - The new path for the file or folder.
 * @returns A promise resolving to the renamed item.
 */
export const renameFileOrFolder = async (oldPath: string, newPath: string): Promise<PathInstance> => {
    const response = await axiosInstance.post<PathInstance>(
        `${WORKSPACE_PREFIX}/rename`,
        {
            old_path: oldPath,
            new_path: newPath,
        },
        {
            headers: { "Content-Type": "application/json" },
        },
    );
    return response.data;
};

export const downloadFileOrFolder = async (path: string, type: "file" | "folder"): Promise<void> => {
    const response = await axiosInstance.get(
        `${WORKSPACE_PREFIX}/download?path=${encodeURIComponent(path)}`,
        {
            responseType: "blob",
        },
    );
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;

    const pathParts = path.split("/");
    let fileName = pathParts[pathParts.length - 1];
    if (type === "folder") {
        fileName += ".zip";
    }
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(url);
};
