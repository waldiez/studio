const EXTENSION = '.waldiez';

export const getInitialPath = (): string => {
    const hash = window.location.hash;
    if (hash && hash.length > 1) {
        return hash.slice(1);
    }
    return '/';
};

export const isFile = (path: string) => {
    if (path.endsWith(EXTENSION)) {
        return true;
    }
    if (path === '/' || path === '' || path.endsWith('/')) {
        return false;
    }
    return path.split('/').pop()?.includes('.');
};

export const getParentPath = (path: string): string => {
    const segments = path.split('/').filter(Boolean);
    return segments.length > 1 ? `/${segments.slice(0, -1).join('/')}` : '/';
};

export const normalizePath = (path: string): string => {
    // Remove duplicate slashes
    path = path.replace(/\/+/g, '/');
    // Ensure it starts with a single slash
    if (!path.startsWith('/')) {
        path = `/${path}`;
    }
    // Remove trailing slash unless it's the root
    if (path.length > 1 && path.endsWith('/')) {
        path = path.slice(0, -1);
    }
    return path;
};
