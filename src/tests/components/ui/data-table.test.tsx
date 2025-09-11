/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { DataTable, type DataTableProps } from "@/components/ui/data-table";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock the UI components
vi.mock("@/components/ui/button", () => ({
    Button: ({ children, onClick, disabled, ...props }: any) => (
        <button onClick={onClick} disabled={disabled} {...props}>
            {children}
        </button>
    ),
}));

vi.mock("@/components/ui/input", () => ({
    Input: ({ onChange, value, ...props }: any) => <input value={value} onChange={onChange} {...props} />,
}));

vi.mock("@/components/ui/select", () => ({
    Select: ({ children, onValueChange, value }: any) => (
        <select data-testid="page-size-select" value={value} onChange={e => onValueChange?.(e.target.value)}>
            {children}
        </select>
    ),
    SelectContent: ({ children }: any) => <>{children}</>,
    SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
    SelectTrigger: ({ children }: any) => <>{children}</>,
    SelectValue: ({ placeholder }: any) => <>{placeholder}</>,
}));

describe("DataTable", () => {
    const mockColumns = [
        {
            id: "name",
            header: "Name",
            accessorKey: "name",
        },
        {
            id: "age",
            header: "Age",
            accessorKey: "age",
        },
    ];

    const mockData = [
        { name: "Alice", age: 31 },
        { name: "Bob", age: 26 },
    ];

    const defaultProps: DataTableProps<any, any> = {
        columns: mockColumns,
        data: mockData,
        total: 2,
        page: 1,
        pageSize: 10,
        onPageChange: vi.fn(),
        onPageSizeChange: vi.fn(),
        sorting: [],
        onSortingChange: vi.fn(),
        filter: "",
        onFilterChange: vi.fn(),
    };

    it("renders table with data", () => {
        render(<DataTable {...defaultProps} />);

        expect(screen.getByText("Alice")).toBeInTheDocument();
        expect(screen.getByText("Bob")).toBeInTheDocument();
        expect(screen.getByText("31")).toBeInTheDocument();
        expect(screen.getByText("26")).toBeInTheDocument();
    });

    it("displays filter input", () => {
        render(<DataTable {...defaultProps} />);

        const filterInput = screen.getByPlaceholderText("Filter…");
        expect(filterInput).toBeInTheDocument();
    });

    it("calls onFilterChange when filter input changes", () => {
        const onFilterChange = vi.fn();
        render(<DataTable {...defaultProps} onFilterChange={onFilterChange} />);

        const filterInput = screen.getByPlaceholderText("Filter…");
        fireEvent.change(filterInput, { target: { value: "Alice" } });

        expect(onFilterChange).toHaveBeenCalledWith("Alice");
    });

    it("displays row count", () => {
        render(<DataTable {...defaultProps} total={100} />);

        expect(screen.getByText("100 rows")).toBeInTheDocument();
    });

    it("shows loading state", () => {
        render(<DataTable {...defaultProps} loading={true} />);

        expect(screen.getByText("Loading…")).toBeInTheDocument();
    });

    it("displays pagination controls", () => {
        render(<DataTable {...defaultProps} page={2} total={50} pageSize={10} />);

        expect(screen.getByText("« First")).toBeInTheDocument();
        expect(screen.getByText("‹ Prev")).toBeInTheDocument();
        expect(screen.getByText("Next ›")).toBeInTheDocument();
        expect(screen.getByText("Last »")).toBeInTheDocument();
        expect(screen.getByText("Page 2 / 5")).toBeInTheDocument();
    });

    it("calls onPageChange when pagination buttons are clicked", () => {
        const onPageChange = vi.fn();
        render(<DataTable {...defaultProps} page={2} total={50} pageSize={10} onPageChange={onPageChange} />);

        fireEvent.click(screen.getByText("« First"));
        expect(onPageChange).toHaveBeenCalledWith(1);

        fireEvent.click(screen.getByText("‹ Prev"));
        expect(onPageChange).toHaveBeenCalledWith(1);

        fireEvent.click(screen.getByText("Next ›"));
        expect(onPageChange).toHaveBeenCalledWith(3);

        fireEvent.click(screen.getByText("Last »"));
        expect(onPageChange).toHaveBeenCalledWith(5);
    });

    it("disables pagination buttons correctly", () => {
        render(<DataTable {...defaultProps} page={1} total={5} pageSize={10} />);

        const firstBtn = screen.getByText("« First");
        const prevBtn = screen.getByText("‹ Prev");
        const nextBtn = screen.getByText("Next ›");
        const lastBtn = screen.getByText("Last »");

        expect(firstBtn).toBeDisabled();
        expect(prevBtn).toBeDisabled();
        expect(nextBtn).toBeDisabled();
        expect(lastBtn).toBeDisabled();
    });

    it("calls onPageSizeChange when page size is changed", () => {
        const onPageSizeChange = vi.fn();
        render(<DataTable {...defaultProps} onPageSizeChange={onPageSizeChange} />);

        const select = screen.getByTestId("page-size-select");
        fireEvent.change(select, { target: { value: "25" } });

        expect(onPageSizeChange).toHaveBeenCalledWith(25);
    });

    it("shows 'No rows' message when data is empty", () => {
        render(<DataTable {...defaultProps} data={[]} />);

        expect(screen.getByText("No rows")).toBeInTheDocument();
    });

    it("handles NULL values in cells", () => {
        const dataWithNull = [{ name: "Alice", age: null }];
        render(<DataTable {...defaultProps} data={dataWithNull} />);

        expect(screen.getByText("NULL")).toBeInTheDocument();
    });

    it("calculates total pages correctly", () => {
        render(<DataTable {...defaultProps} total={23} pageSize={10} page={3} />);

        expect(screen.getByText("Page 3 / 3")).toBeInTheDocument();
    });

    it("handles minimum of 1 total page", () => {
        render(<DataTable {...defaultProps} total={0} pageSize={10} page={1} />);

        expect(screen.getByText("Page 1 / 1")).toBeInTheDocument();
    });
});
