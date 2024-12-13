import { act, fireEvent, render, screen } from '@testing-library/react';

import { PathItem } from '@waldiez/studio/components/PathItem';
import { PathInstance } from '@waldiez/studio/types';

const mockOnRename = vi.fn();
const mockOnDelete = vi.fn();
const mockOnNavigate = vi.fn();
const mockOnDownload = vi.fn();

describe('PathItem Component', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });
    const mockItem: PathInstance = {
        name: 'test.txt',
        path: '/path/to/test.waldiez',
        type: 'file'
    };

    const mockFolderItem: PathInstance = {
        name: 'folder',
        path: '/path/to/folder',
        type: 'folder'
    };

    const mockUpFolderItem: PathInstance = {
        name: '..',
        path: '/path',
        type: 'folder'
    };

    it('renders file item correctly', () => {
        render(
            <PathItem
                currentPath="/path/to"
                item={mockItem}
                onRename={mockOnRename}
                onDelete={mockOnDelete}
                onNavigate={mockOnNavigate}
                onDownload={mockOnDownload}
            />
        );

        expect(screen.getByText('test.txt')).toBeInTheDocument();
    });

    it('renders folder item correctly', () => {
        render(<PathItem currentPath="/path/to" item={mockFolderItem} onNavigate={mockOnNavigate} />);

        expect(screen.getByText('folder')).toBeInTheDocument();
    });

    it('renders up-folder item correctly', () => {
        render(<PathItem currentPath="/path/to" item={mockUpFolderItem} onNavigate={mockOnNavigate} />);

        expect(screen.getByText('..')).toBeInTheDocument();
    });

    it('calls onNavigate when clicking on a navigable item', () => {
        render(<PathItem currentPath="/path/to" item={mockFolderItem} onNavigate={mockOnNavigate} />);

        const clickableName = screen.getByText('folder');
        fireEvent.click(clickableName);

        expect(mockOnNavigate).toHaveBeenCalledWith(mockFolderItem, expect.anything());
        expect(mockOnNavigate).toHaveBeenCalledTimes(1);
    });

    it('does not call onNavigate for non-navigable items', () => {
        render(<PathItem currentPath="/path/to/test.txt" item={mockItem} />);

        const name = screen.getByText('test.txt');
        fireEvent.click(name);

        expect(mockOnNavigate).not.toHaveBeenCalled();
    });

    it('handles renaming a file', async () => {
        render(<PathItem currentPath="/path/to" item={mockItem} onRename={mockOnRename} />);

        const editButton = screen.getByTestId('edit-button');
        fireEvent.click(editButton);

        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'newTest.txt' } });
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

        expect(mockOnRename).toHaveBeenCalledWith(mockItem, 'newTest.txt');
    });

    it('cancels renaming a file', () => {
        render(<PathItem currentPath="/path/to" item={mockItem} onRename={mockOnRename} />);

        const editButton = screen.getByTestId('edit-button');
        fireEvent.click(editButton);

        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'newTest.txt' } });
        fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });

        expect(mockOnRename).not.toHaveBeenCalled();
    });

    it('handles deleting an item', async () => {
        render(<PathItem currentPath="/path/to" item={mockItem} onDelete={mockOnDelete} />);

        const deleteButton = screen.getByTestId('delete-button');
        fireEvent.click(deleteButton);

        expect(mockOnDelete).toHaveBeenCalledWith(mockItem);
    });

    it('shows and hides context menu', () => {
        render(<PathItem currentPath="/path/to" item={mockItem} onDownload={mockOnDownload} />);

        const pathItem = screen.getByTestId('path-item');
        fireEvent.contextMenu(pathItem);

        expect(screen.getByText('Download')).toBeInTheDocument();

        fireEvent.mouseDown(document.body);
        expect(screen.queryByText('Download')).not.toBeInTheDocument();
    });

    it('handles downloading a file', async () => {
        render(<PathItem currentPath="/path/to" item={mockItem} onDownload={mockOnDownload} />);

        const pathItem = screen.getByTestId('path-item');
        act(() => {
            fireEvent.contextMenu(pathItem);
        });

        const downloadButton = screen.getByText('Download');
        await act(async () => {
            fireEvent.click(downloadButton);
        });

        expect(mockOnDownload).toHaveBeenCalledWith(mockItem);
    });
});
