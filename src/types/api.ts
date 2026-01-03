/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */

export type PathItem = { name: string; path: string; type: "file" | "folder" };
export type PathInstancesResponse = { items: PathItem[] };
export type PathInstance = PathItem;
export type MessageResponse = { message: string };

export type GetFileText = {
    kind: "text";
    path: string;
    mime: string;
    content: string;
};

export type GetFileBinary = {
    kind: "binary";
    path: string;
    mime: string;
    blob?: Blob;
    url?: string;
    filename: string;
};

export type GetFileResponse = GetFileText | GetFileBinary;
