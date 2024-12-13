import { describe, expect, it, vi } from 'vitest';

import axiosInstance from '@waldiez/studio/api/axiosInstance';
import * as fileBrowserService from '@waldiez/studio/api/fileBrowserService';

vi.mock('@waldiez/studio/api/axiosInstance', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        delete: vi.fn()
    }
}));

describe('fileBrowserService', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('fetchFiles calls axiosInstance.get with correct parameters', async () => {
        const mockResponse = { data: [] };
        (axiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

        const parent = '/test';
        const result = await fileBrowserService.fetchFiles(parent);

        expect(axiosInstance.get).toHaveBeenCalledWith('/workspace', { params: { parent } });
        expect(result).toEqual(mockResponse.data);
    });

    it('createFolder calls axiosInstance.post with correct parameters', async () => {
        const mockResponse = { data: { id: 1, name: 'New Folder' } };
        (axiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

        const parent = '/';
        const result = await fileBrowserService.createFolder(parent);

        expect(axiosInstance.post).toHaveBeenCalledWith('/workspace', { type: 'folder', parent });
        expect(result).toEqual(mockResponse.data);
    });

    it('createFile calls axiosInstance.post with correct parameters', async () => {
        const mockResponse = { data: { id: 1, name: 'New File' } };
        (axiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

        const parent = '/';
        const result = await fileBrowserService.createFile(parent);

        expect(axiosInstance.post).toHaveBeenCalledWith('/workspace', { type: 'file', parent });
        expect(result).toEqual(mockResponse.data);
    });

    it('uploadFile calls axiosInstance.post with correct parameters', async () => {
        const mockResponse = { data: { id: 1, name: 'Uploaded File' } };
        (axiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

        const path = '/';
        const file = new File(['test'], 'test.txt', { type: 'text/plain' });
        const result = await fileBrowserService.uploadFile(path, file);

        expect(axiosInstance.post).toHaveBeenCalledWith('/workspace/upload', expect.any(FormData), {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        expect(result).toEqual(mockResponse.data);
    });

    it('deleteFileOrFolder calls axiosInstance.delete with correct parameters', async () => {
        const mockResponse = { data: { message: 'Deleted successfully' } };
        (axiosInstance.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

        const path = '/test';
        const result = await fileBrowserService.deleteFileOrFolder(path);

        expect(axiosInstance.delete).toHaveBeenCalledWith(`/workspace?path=${encodeURIComponent(path)}`);
        expect(result).toEqual(mockResponse.data);
    });

    it('renameFileOrFolder calls axiosInstance.post with correct parameters', async () => {
        const mockResponse = { data: { id: 1, name: 'Renamed Item' } };
        (axiosInstance.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

        const oldPath = '/old';
        const newPath = '/new';
        const result = await fileBrowserService.renameFileOrFolder(oldPath, newPath);

        expect(axiosInstance.post).toHaveBeenCalledWith(
            '/workspace/rename',
            { old_path: oldPath, new_path: newPath },
            { headers: { 'Content-Type': 'application/json' } }
        );
        expect(result).toEqual(mockResponse.data);
    });

    it('downloadFileOrFolder creates a download link', async () => {
        const mockBlob = new Blob(['test content']);
        const mockResponse = { data: mockBlob };
        (axiosInstance.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

        const path = '/test';
        const type = 'folder';

        const createElementSpy = vi.spyOn(document, 'createElement');
        const revokeObjectURLSpy = vi.spyOn(global.URL, 'revokeObjectURL');

        await fileBrowserService.downloadFileOrFolder(path, type);

        expect(axiosInstance.get).toHaveBeenCalledWith(
            `/workspace/download?path=${encodeURIComponent(path)}`,
            { responseType: 'blob' }
        );
        expect(createElementSpy).toHaveBeenCalledWith('a');
        expect(revokeObjectURLSpy).toHaveBeenCalled();
    });
});
