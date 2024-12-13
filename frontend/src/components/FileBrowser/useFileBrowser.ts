import { createContext, useContext } from 'react';

import { PathInstance, PathInstanceType } from '@waldiez/studio/types';

type FileBrowserContextType = {
    currentPath: string;
    entries: PathInstance[];
    error: string | null;
    loading: boolean;
    setError: (error: string | null) => void;
    refresh: () => Promise<void>;
    onNavigate: (path: PathInstance) => void;
    onCreate: (type: PathInstanceType) => Promise<void>;
    onDelete: (path: PathInstance) => Promise<void>;
    onRename: (item: PathInstance, newName: string) => Promise<void>;
    onUpload: (file: File) => Promise<void>;
    onDownload: (path: PathInstance) => Promise<void>;
};

export const FileBrowserContext = createContext<FileBrowserContextType | undefined>(undefined);

export const useFileBrowser = () => {
    const context = useContext(FileBrowserContext);
    if (!context) {
        throw new Error('useFileBrowser must be used within a FileBrowserProvider');
    }
    return context;
};
