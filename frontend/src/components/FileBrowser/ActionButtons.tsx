/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import React, { useRef } from "react";
import { FaPlus, FaUpload } from "react-icons/fa";

export const ActionButtons: React.FC<{
    onNewFile: () => Promise<void>;
    onNewFolder: () => Promise<void>;
    onUpload: (file: File) => Promise<void>;
}> = ({ onNewFile, onNewFolder, onUpload }) => {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    /**
     * Handle file selection for upload.
     */
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0) {
            return; // No file selected
        }

        const file = event.target.files[0]; // Get the first selected file
        try {
            await onUpload(file); // Assuming onUpload is an async function that handles the upload logic
        } catch (error) {
            console.error("Error uploading file:", error);
        } finally {
            event.target.value = ""; // Reset the file input to allow re-uploading the same file
        }
    };
    return (
        <div className="actions-buttons">
            <button className="action-button" onClick={onNewFile}>
                <FaPlus aria-hidden="true" />
                New Flow
            </button>
            <button className="action-button" onClick={onNewFolder}>
                <FaPlus aria-hidden="true" />
                New Folder
            </button>
            <button
                data-testid="upload-button"
                className="action-button"
                onClick={() => fileInputRef.current?.click()}
            >
                <FaUpload aria-hidden="true" />
                Upload
            </button>
            <input
                title="Upload File"
                data-testid="file-input"
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={handleFileUpload}
            />
        </div>
    );
};
