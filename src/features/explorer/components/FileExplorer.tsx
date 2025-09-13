/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { findFileIcon } from "@/components/ui/fileIcon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { PathItem } from "@/types/api";
import { ArrowUp, Folder, MoreVertical, Pencil, Plus, Trash2, Upload } from "lucide-react";

import * as React from "react";

import { useFileSystem } from "../hooks/useFileSystem";

type Props = {
    /** called when user wants to open a file */
    onOpenFile?: (item: PathItem) => void;
};

export default function FileExplorer({ onOpenFile }: Props) {
    const fs = useFileSystem();
    const [renaming, setRenaming] = React.useState<string | null>(null);
    const [renameValue, setRenameValue] = React.useState("");

    const onItemDoubleClick = (it: PathItem) => {
        if (it.type === "folder") {
            fs.goTo(`/${it.path}`.replace(/^\/\/+/, "/"));
        } else {
            onOpenFile?.(it);
        }
    };

    const beginRename = (it: PathItem) => {
        setRenaming(it.path);
        setRenameValue(it.name);
    };
    const commitRename = async (it: PathItem) => {
        if (!renameValue || renameValue === it.name) {
            setRenaming(null);
            return;
        }
        const parent = it.path.split("/").slice(0, -1).join("/");
        const newPath = parent ? `${parent}/${renameValue}` : renameValue;
        await fs.rename(it.path, newPath);
        setRenaming(null);
    };

    const fileInputRef = React.useRef<HTMLInputElement | null>(null);

    return (
        <div className="h-full flex flex-col bg-[var(--background-color)]">
            {/* Toolbar */}
            <div className="h-10 px-2 flex items-center gap-1 border-b border-[var(--border-color)]">
                <Button size="sm" variant="outline" onClick={() => fs.goUp()} title="Up one folder">
                    <ArrowUp className="size-4" />
                </Button>
                {/* <div className="text-xs opacity-70 truncate">{fs.cwd}</div> */}
                <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" onClick={() => fs.createFolder()} title="New folder">
                        <Folder className="size-4 mr-1" /> New
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => fs.createFile()} title="New file">
                        <Plus className="size-4 mr-1" /> File
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        title="Upload"
                    >
                        <Upload className="size-4 mr-1" /> Upload
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={async e => {
                            const f = e.currentTarget ? e.currentTarget.files?.[0] : e.target.files?.[0];
                            if (f) {
                                await fs.upload(f);
                            }
                            e.currentTarget ? (e.currentTarget.value = "") : (e.target.value = "");
                        }}
                    />
                </div>
            </div>

            {/* Breadcrumbs */}
            <div className="px-2 py-1 text-xs flex gap-1 flex-wrap border-b border-[var(--border-color)]">
                {fs.breadcrumbs.map((b, i) => (
                    <span key={b.path} className="flex items-center gap-1">
                        <button className="hover:underline" onClick={() => fs.goTo(b.path)}>
                            {b.label}
                        </button>
                        {i < fs.breadcrumbs.length - 1 && <span>/</span>}
                    </span>
                ))}
            </div>

            {/* List */}
            <div className="flex-1 min-h-0 overflow-auto text-sm">
                {fs.loading && <div className="p-3 opacity-70">Loading…</div>}
                {fs.error && <div className="p-3 text-red-500">{fs.error}</div>}
                {!fs.loading && fs.items.length === 0 && <div className="p-3 opacity-70">Empty folder</div>}

                <ul
                    className="select-none"
                    onClick={e => {
                        if (e.target === e.currentTarget) {
                            fs.setSelection(null);
                        }
                    }}
                >
                    {fs.items.map(it => {
                        const selected = fs.selection?.path === it.path;
                        return (
                            <li
                                key={it.path}
                                className={cn(
                                    "group px-2 py-1 flex items-center gap-2 hover:bg-[var(--primary-alt-color-hover)] cursor-default",
                                    selected && "bg-[var(--primary-alt-color-hover)]",
                                )}
                                onClick={() => fs.setSelection(it)}
                                onDoubleClick={() => onItemDoubleClick(it)}
                            >
                                <span className="shrink-0">
                                    {it.type === "folder" ? (
                                        <Folder className="size-4" />
                                    ) : (
                                        findFileIcon(it.path)
                                    )}
                                </span>

                                {/* name / inline rename */}
                                {renaming === it.path ? (
                                    <div className="flex-1">
                                        <Input
                                            autoFocus
                                            value={renameValue}
                                            onChange={e => setRenameValue(e.target.value)}
                                            onBlur={() => commitRename(it)}
                                            onKeyDown={e => {
                                                if (e.key === "Enter") {
                                                    void commitRename(it);
                                                }
                                                if (e.key === "Escape") {
                                                    setRenaming(null);
                                                }
                                            }}
                                            className="h-7 text-sm"
                                        />
                                    </div>
                                ) : (
                                    <span className="flex-1 truncate" title={it.name}>
                                        {it.name}
                                    </span>
                                )}

                                {/* actions */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="opacity-0 group-hover:opacity-100"
                                        >
                                            <MoreVertical className="size-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="min-w-40">
                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => beginRename(it)}>
                                            <Pencil className="size-4 mr-2" /> Rename
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            className="text-red-600 focus:text-red-600"
                                            onClick={() => fs.remove(it.path)}
                                        >
                                            <Trash2 className="size-4 mr-2" /> Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
