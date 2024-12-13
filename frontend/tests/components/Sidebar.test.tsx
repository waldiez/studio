import { act, render, screen } from '@testing-library/react';

import { ReactNode } from 'react';

import { SidebarContext, SidebarProvider, useSidebar } from '@waldiez/studio/components/Sidebar';

describe('SidebarContext and SidebarProvider', () => {
    const TestComponent: React.FC = () => {
        const { isSidebarVisible, toggleSidebar } = useSidebar();
        return (
            <div>
                <span data-testid="sidebar-status">{isSidebarVisible ? 'Visible' : 'Hidden'}</span>
                <button data-testid="toggle-button" onClick={toggleSidebar}>
                    Toggle Sidebar
                </button>
            </div>
        );
    };

    it('throws an error if useSidebar is used outside SidebarProvider', () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); // Suppress error logs

        expect(() => render(<TestComponent />)).toThrow('useSidebar must be used within a SidebarProvider');

        errorSpy.mockRestore();
    });

    it('provides initial sidebar visibility as true', () => {
        render(
            <SidebarProvider>
                <TestComponent />
            </SidebarProvider>
        );

        const status = screen.getByTestId('sidebar-status');
        expect(status).toHaveTextContent('Visible');
    });

    it('toggles sidebar visibility', () => {
        render(
            <SidebarProvider>
                <TestComponent />
            </SidebarProvider>
        );

        const status = screen.getByTestId('sidebar-status');
        const toggleButton = screen.getByTestId('toggle-button');

        // Sidebar initially visible
        expect(status).toHaveTextContent('Visible');

        // Toggle visibility
        act(() => {
            toggleButton.click();
        });
        expect(status).toHaveTextContent('Hidden');

        // Toggle back to visible
        act(() => {
            toggleButton.click();
        });
        expect(status).toHaveTextContent('Visible');
    });

    it('allows custom initial state via mock provider', () => {
        const MockProvider: React.FC<{ children: ReactNode }> = ({ children }) => (
            <SidebarContext.Provider
                value={{
                    isSidebarVisible: false,
                    toggleSidebar: vi.fn()
                }}
            >
                {children}
            </SidebarContext.Provider>
        );

        render(
            <MockProvider>
                <TestComponent />
            </MockProvider>
        );

        const status = screen.getByTestId('sidebar-status');
        expect(status).toHaveTextContent('Hidden');
    });
});
