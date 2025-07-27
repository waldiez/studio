/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import React, { useEffect, useRef, useState } from "react";

import { findFileIcon } from "@waldiez/studio/components/PathItem/FileIcon";
import { PathInstance } from "@waldiez/studio/types";

const EXTENSION = ".waldiez";

type PathItemProps = {
    currentPath: string;
    item: PathInstance;
    onRename?: (path: PathInstance, newName: string) => Promise<void> | null;
    onDelete?: (path: PathInstance) => Promise<void> | null;
    onClick?: (path: PathInstance) => void | null;
    onDownload?: (path: PathInstance) => Promise<void> | null;
};

export const usePathItem = (props: PathItemProps) => {
    const { item, currentPath, onDelete, onRename, onClick, onDownload } = props;
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState(item.name);
    const [contextMenuVisible, setContextMenuVisible] = useState(false);
    const [contextMenuPosition, setContextMenuPosition] = useState<{
        x: number;
        y: number;
    } | null>(null);

    const contextMenuRef = useRef<HTMLDivElement | null>(null);
    const fileIcon = findFileIcon(item.name);
    useEffect(() => {
        setNewName(item.name);
    }, [item]);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                contextMenuVisible &&
                contextMenuRef.current &&
                !contextMenuRef.current.contains(event.target as Node)
            ) {
                closeContextMenu();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [contextMenuVisible]);
    const handleDelete = async () => {
        if (onDelete) {
            await onDelete(item);
        }
    };
    const handleRename = async () => {
        setIsEditing(false);
        if (newName !== item.name) {
            if (onRename) {
                await onRename(item, newName);
            }
        }
    };
    const handleDownload = async () => {
        if (onDownload) {
            await onDownload(item);
        }
    };
    const onNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setNewName(event.target.value);
    };
    const handleCancel = () => {
        setIsEditing(false);
        setNewName(item.name);
    };

    const canNavigate = (): boolean => {
        if (item.type === "folder" && item.name === "..") {
            return true;
        }
        const itemPath = item.path;
        if (item.type === "folder" && currentPath !== itemPath) {
            return true;
        }
        return item.type === "file" && item.name.endsWith(EXTENSION) && currentPath !== itemPath;
    };

    const canClick = onClick !== null && canNavigate();
    const handleContextMenu = (event: React.MouseEvent) => {
        event.preventDefault();
        setContextMenuVisible(true);
        setContextMenuPosition({ x: event.clientX, y: event.clientY });
    };

    const closeContextMenu = () => {
        setContextMenuVisible(false);
        setContextMenuPosition(null);
    };
    return {
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
        canNavigate,
        handleContextMenu,
        closeContextMenu,
    };
};
