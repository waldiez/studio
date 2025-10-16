/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import axiosInstance from "@/lib/axiosInstance";
import type { GetFileResponse, MessageResponse, PathInstance, PathInstancesResponse } from "@/types/api";
export { default as axiosInstance } from "@/lib/axiosInstance";

const WORKSPACE_PREFIX = "/workspace";

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
 * @param opts - Options for the request (onProgress and abortSignal)
 * @returns A promise resolving to the uploaded file information.
 */
export const uploadFile = async (
    path: string = "/",
    file: File,
    opts?: { onProgress?: (p: number) => void; signal?: AbortSignal },
): Promise<PathInstance> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("path", path);

    const response = await axiosInstance.post<PathInstance>(`${WORKSPACE_PREFIX}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: e => {
            if (e.total) {
                opts?.onProgress?.(Math.round((e.loaded / e.total) * 100));
            }
        },
        signal: opts?.signal,
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

/**
 * Download a file or folder.
 *
 * @param path - The file or folder relative to workspace dir
 * @param type - The type of the thing to download: file | folder
 */
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

/**
 * Save a text file.
 *
 * @param path - The path of the file relative to the workspace dir
 * @param content - The content of the file
 */
export const saveTextFile = async (path: string, content: string): Promise<void> => {
  await axiosInstance.post("/workspace/save", { path, content });
};

/**
 * Get a file.
 *
 * @param path - The path relative to the workspace dir
 * @returns A promise with the file response
 */
export const getFile = async (path: string): Promise<GetFileResponse> => {
  const url = `${WORKSPACE_PREFIX}/get`;

  // Check file extension to determine if it's textual or binary
  const ext = path.toLowerCase().slice(path.lastIndexOf("."));
  const isTextual = TEXTUAL_EXTS.has(ext);

  if (isTextual) {
    // For textual files, make GET request expecting JSON response
    try {
      const resp = await axiosInstance.get(url, {
        params: { path },
        responseType: "json",
        validateStatus: () => true,
      });

      if (resp.status !== 200) {
        const msg = resp.data?.detail || resp.statusText || "Request failed";
        throw new Error(msg);
      }

      // Backend returns: { path: string, mime: string, content: string }
      return { kind: "text", ...resp.data };
    } catch (error) {
      // If somehow this fails, fall back to treating as binary
      console.warn(`Failed to load textual file ${path}:`, error);
      throw error;
    }
  }

  // For media/binary files, return direct URL (no fetch needed!)
  const mediaUrl = `/api${WORKSPACE_PREFIX}/get?${new URLSearchParams({ path }).toString()}`;

  return {
    kind: "binary",
    path,
    mime: guessMimeType(ext),
    url: mediaUrl, // Browser will handle this directly
    filename: path.split("/").pop() || "download",
  };
};


const guessMimeType = (ext: string): string => {
  const mimeMap: Record<string, string> = {
    // Images
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    // Videos
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".ogg": "video/ogg",
    // Audio
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".oga": "audio/ogg",
    // Other
    ".pdf": "application/pdf",
  };

  return mimeMap[ext] || "application/octet-stream";
};

// Textual extensions
const TEXTUAL_EXTS = new Set([
  ".js", ".jsx", ".cjs", ".mjs", ".ts", ".tsx",
  ".env", ".txt", ".py", ".csv", ".json" ,
  ".md", ".mmd", ".rst", ".css", ".html", ".xml", 
  ".yaml", ".yml", ".toml", ".ini", ".ipynb", ".sh", 
  ".bash", ".bsh", ".sh", ".zsh", ".ps1", ".bat",
  ".rs", ".java", ".waldiez"
]);
