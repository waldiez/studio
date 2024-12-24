import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, vi } from "vitest";

import { Header } from "@waldiez/studio/components/FileBrowser/Header";

describe("Header Component", () => {
    it("renders correctly when sidebar is visible", () => {
        render(<Header isSidebarVisible={true} refresh={vi.fn()} loading={false} toggleSidebar={vi.fn()} />);

        expect(screen.getByText("Workspace")).toBeInTheDocument();
        expect(screen.getByLabelText("Refresh")).toBeInTheDocument();
    });

    it("calls refresh function on refresh button click", async () => {
        const refreshMock = vi.fn();
        render(
            <Header isSidebarVisible={true} refresh={refreshMock} loading={false} toggleSidebar={vi.fn()} />,
        );

        const refreshButton = screen.getByLabelText("Refresh");
        await userEvent.click(refreshButton);

        expect(refreshMock).toHaveBeenCalledTimes(1);
    });

    it("disables refresh button when loading", () => {
        render(<Header isSidebarVisible={true} refresh={vi.fn()} loading={true} toggleSidebar={vi.fn()} />);

        const refreshButton = screen.getByLabelText("Refresh");
        expect(refreshButton).toBeDisabled();
    });

    it("calls toggleSidebar on sidebar toggle icon click", async () => {
        const toggleSidebarMock = vi.fn();
        render(
            <Header
                isSidebarVisible={false}
                refresh={vi.fn()}
                loading={false}
                toggleSidebar={toggleSidebarMock}
            />,
        );

        const toggleIcon = screen.getByRole("button", { hidden: true });
        await userEvent.click(toggleIcon);

        expect(toggleSidebarMock).toHaveBeenCalledTimes(1);
    });
});
