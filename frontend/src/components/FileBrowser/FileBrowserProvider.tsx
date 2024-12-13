import React, { useEffect, useState } from 'react';

import * as fileBrowserService from '@waldiez/studio/api/fileBrowserService';
import { FileBrowserContext } from '@waldiez/studio/components/FileBrowser/useFileBrowser';
import { PathInstance, PathInstanceType } from '@waldiez/studio/types';
import { debounce } from '@waldiez/studio/utils/debounce';
import { getInitialPath, getParentPath, isFile, normalizePath } from '@waldiez/studio/utils/paths';

export const FileBrowserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentPath, setCurrentPath] = useState<string>(getInitialPath());
    const [entries, setEntries] = useState<PathInstance[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        (async () => {
            if (isFile(currentPath)) {
                await fetchEntries(getParentPath(currentPath));
            } else {
                await fetchEntries(currentPath);
            }
        })();
    }, [currentPath]);

    const fetchEntries = async (path: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fileBrowserService.fetchFiles(path);
            const parentEntry =
                path !== '/'
                    ? [{ name: '..', path: getParentPath(path), type: 'folder' as PathInstanceType }]
                    : [];
            setEntries([...parentEntry, ...response.items]);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
        } finally {
            setLoading(false);
        }
    };

    const fetchEntriesDebounced = debounce(fetchEntries, 200);

    const setPath = (path: string) => {
        const sanitizedPath = normalizePath(path);
        setCurrentPath(sanitizedPath);
        window.location.hash = `#${sanitizedPath}`;
        return sanitizedPath;
    };

    const onNavigate = async (item: PathInstance, noDebounce: boolean = true) => {
        if (item.path === currentPath || `/${item.path}` === currentPath) {
            return;
        }
        const sanitizedPath = setPath(item.path);
        if (item.type === 'file') {
            return;
        }
        if (noDebounce) {
            await fetchEntries(sanitizedPath);
        } else {
            await fetchEntriesDebounced(sanitizedPath);
        }
    };
    const onCreate = async (type: PathInstanceType) => {
        const parent = isFile(currentPath) ? getParentPath(currentPath) : currentPath;
        try {
            if (type === 'folder') {
                await fileBrowserService.createFolder(parent);
            } else if (type === 'file') {
                await fileBrowserService.createFile(parent);
            }
        } catch (err: any) {
            setError(`Failed to create ${type}: ${err.message}`);
        } finally {
            await refresh(true);
        }
    };

    const onDelete = async (item: PathInstance) => {
        try {
            await fileBrowserService.deleteFileOrFolder(item.path);
            if (item.path === currentPath || `/${item.path}` === currentPath) {
                setPath(getParentPath(item.path));
            }
        } catch (err: any) {
            setError(`Failed to delete entry: ${err.message}`);
        } finally {
            await refresh();
        }
    };

    const onRename = async (item: PathInstance, newName: string) => {
        if (item.name === newName) {
            return;
        }
        try {
            const newPath = `${getParentPath(item.path)}/${newName}`;
            await fileBrowserService.renameFileOrFolder(item.path, newPath);
            if (item.path === currentPath || `/${item.path}` === currentPath) {
                setPath(newPath);
            }
        } catch (err: any) {
            setError(`Failed to rename entry: ${err.message}`);
        } finally {
            await refresh(true);
        }
    };

    const onUpload = async (file: File): Promise<void> => {
        const path = normalizePath(currentPath);
        setLoading(true);
        try {
            if (isFile(path)) {
                await fileBrowserService.uploadFile(getParentPath(path), file);
            } else {
                await fileBrowserService.uploadFile(path, file);
            }
        } catch (err: any) {
            setError(`Failed to upload file: ${err.message}`);
        } finally {
            setLoading(false);
            await refresh();
        }
    };

    const refresh = async (noDebounce: boolean = false) => {
        const path = normalizePath(currentPath);
        let dirToFetch = path;
        if (isFile(path)) {
            dirToFetch = getParentPath(path);
        }
        if (noDebounce) {
            await fetchEntries(dirToFetch);
        } else {
            await fetchEntriesDebounced(dirToFetch);
        }
    };

    const onDownload = async (item: PathInstance) => {
        try {
            await fileBrowserService.downloadFileOrFolder(item.path, item.type);
        } catch (err: any) {
            setError(`Failed to download entry: ${err.message}`);
        }
    };

    return (
        <FileBrowserContext.Provider
            value={{
                currentPath,
                entries,
                error,
                loading,
                setError,
                refresh,
                onNavigate,
                onCreate,
                onDelete,
                onRename,
                onUpload,
                onDownload
            }}
        >
            {children}
        </FileBrowserContext.Provider>
    );
};
