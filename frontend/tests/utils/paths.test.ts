import { describe, expect, it } from 'vitest';

import { getInitialPath, getParentPath, isFile, normalizePath } from '@waldiez/studio/utils/paths';

describe('paths utility functions', () => {
    describe('getInitialPath', () => {
        it('should return the hash without the leading #', () => {
            window.location.hash = '#/test/path';
            expect(getInitialPath()).toBe('/test/path');
        });

        it('should return / if there is no hash', () => {
            window.location.hash = '';
            expect(getInitialPath()).toBe('/');
        });
    });

    describe('isFile', () => {
        it('should return true for paths ending with .waldiez', () => {
            expect(isFile('/path/to/file.waldiez')).toBe(true);
        });

        it('should return false for root path', () => {
            expect(isFile('/')).toBe(false);
        });

        it('should return false for empty path', () => {
            expect(isFile('')).toBe(false);
        });

        it('should return false for paths ending with /', () => {
            expect(isFile('/path/to/directory/')).toBe(false);
        });

        it('should return true for paths containing a dot', () => {
            expect(isFile('/path/to/file.txt')).toBe(true);
        });

        it('should return false for paths without a dot', () => {
            expect(isFile('/path/to/directory')).toBe(false);
        });
    });

    describe('getParentPath', () => {
        it('should return the parent path', () => {
            expect(getParentPath('/path/to/file')).toBe('/path/to');
        });

        it('should return / for root path', () => {
            expect(getParentPath('/')).toBe('/');
        });

        it('should return / for single segment path', () => {
            expect(getParentPath('/file')).toBe('/');
        });
    });

    describe('normalizePath', () => {
        it('should remove duplicate slashes', () => {
            expect(normalizePath('/path//to///file')).toBe('/path/to/file');
        });

        it('should ensure the path starts with a single slash', () => {
            expect(normalizePath('path/to/file')).toBe('/path/to/file');
        });

        it('should remove trailing slash unless it is the root', () => {
            expect(normalizePath('/path/to/file/')).toBe('/path/to/file');
            expect(normalizePath('/')).toBe('/');
        });
    });
});
