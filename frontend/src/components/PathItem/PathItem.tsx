/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import React from "react";
import { FaEdit, FaFolder, FaTrashAlt } from "react-icons/fa";
import { MdCancel, MdDone } from "react-icons/md";

import "@waldiez/studio/components/PathItem/PathItem.css";
import { usePathItem } from "@waldiez/studio/components/PathItem/usePathItem";
import { PathInstance } from "@waldiez/studio/types";

export const PathItem: React.FC<{
    currentPath: string;
    item: PathInstance;
    onRename?: (path: PathInstance, newName: string) => Promise<void>;
    onDelete?: (path: PathInstance) => Promise<void>;
    onClick?: (path: PathInstance) => void;
    onConvert?: (path: PathInstance) => Promise<void>;
    onDownload?: (path: PathInstance) => Promise<void>;
}> = ({
    currentPath,
    item,
    onRename = undefined,
    onDelete = undefined,
    onClick = undefined,
    onDownload = undefined,
}) => {
    const {
        isEditing,
        newName,
        fileIcon,
        canClick,
        contextMenuVisible,
        contextMenuPosition,
        contextMenuRef,
        setIsEditing,
        handleDelete,
        handleRename,
        handleDownload,
        onNameChange,
        handleCancel,
        handleContextMenu,
        closeContextMenu,
    } = usePathItem({
        currentPath,
        item,
        onRename,
        onDelete,
        onClick,
        onDownload,
    });
    const renderIcon = () => {
        if (isEditing) {
            return <MdCancel className="path-item-edit" onClick={handleCancel} />;
        }
        return item.type === "folder" ? <FaFolder className="path-item-icon" /> : fileIcon;
    };
    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            // noinspection JSIgnoredPromiseFromCall
            handleRename();
        } else if (event.key === "Escape") {
            handleCancel();
        }
    };
    const renderName = () => {
        if (isEditing) {
            return (
                <input
                    title="Press Enter to save, Esc to cancel"
                    type="text"
                    className="path-name-input"
                    data-testid="path-name-input"
                    value={newName}
                    onChange={onNameChange}
                    onKeyDown={handleKeyDown}
                />
            );
        }
        if (canClick && onClick) {
            return (
                <span
                    className="path-name clickable"
                    data-testid="path-navigate"
                    onClick={onClick.bind(null, item)}
                >
                    {item.name}
                </span>
            );
        }
        return <div className="path-name">{item.name}</div>;
    };
    const renderRenameAction = () => {
        if (item.name === ".." || !onRename) {
            return null;
        }
        return isEditing ? (
            <MdDone className="path-item-edit" data-testid="save-button" onClick={handleRename} />
        ) : (
            <FaEdit className="path-item-edit" data-testid="edit-button" onClick={() => setIsEditing(true)} />
        );
    };

    const renderDeleteAction = () => {
        if (item.name === ".." || !onDelete) {
            return null;
        }
        return <FaTrashAlt className="path-item-delete" data-testid="delete-button" onClick={handleDelete} />;
    };
    return (
        <div
            data-testid="path-item"
            className={`path-item ${canClick ? "" : "read-only"} ${item.name === ".." ? "up" : ""}`}
            onContextMenu={handleContextMenu}
        >
            {contextMenuVisible && contextMenuPosition && item.name !== ".." && (
                <div
                    ref={contextMenuRef}
                    style={{
                        top: contextMenuPosition.y,
                        left: contextMenuPosition.x,
                    }}
                    className="context-menu"
                >
                    <button
                        onClick={async () => {
                            await handleDownload();
                            closeContextMenu();
                        }}
                        className="context-menu-item"
                        data-testid="download-button"
                    >
                        Download
                    </button>
                </div>
            )}
            {renderIcon()}
            {renderName()}
            {renderRenameAction()}
            {renderDeleteAction()}
        </div>
    );
};
