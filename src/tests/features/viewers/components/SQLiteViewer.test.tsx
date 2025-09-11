/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import SQLiteViewer from "@/features/viewers/components/SQLiteViewer";
import axiosInstance from "@/lib/axiosInstance";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/components/ui/data-table", () => ({
    DataTable: ({ columns, data, total, page, pageSize, loading, filter, onFilterChange }: any) => (
        <div data-testid="data-table">
            <div data-testid="table-columns">{columns.length}</div>
            <div data-testid="table-rows">{data.length}</div>
            <div data-testid="table-total">{total}</div>
            <div data-testid="table-page">{page}</div>
            <div data-testid="table-page-size">{pageSize}</div>
            <div data-testid="table-loading">{loading.toString()}</div>
            <input
                data-testid="table-filter"
                value={filter}
                onChange={e => onFilterChange?.(e.target.value)}
            />
        </div>
    ),
}));

vi.mock("@/components/ui/select", () => {
    let _onValueChange: ((v: string) => void) | undefined;

    const Select = ({ children, onValueChange, value }: any) => {
        _onValueChange = onValueChange;
        return (
            <div data-testid="select">
                <button onClick={() => onValueChange?.("table1")} data-testid="select-button">
                    {value || "Select a table"}
                </button>
                {children}
            </div>
        );
    };

    const SelectContent = ({ children }: any) => <div data-testid="select-content">{children}</div>;

    // Make SelectItem clickable -> calls parent's onValueChange with its value
    const SelectItem = ({ children, value }: any) => (
        <button type="button" data-testid={`select-item-${value}`} onClick={() => _onValueChange?.(value)}>
            {children}
        </button>
    );

    const SelectTrigger = ({ children }: any) => <div data-testid="select-trigger">{children}</div>;
    const SelectValue = ({ placeholder }: any) => <div data-testid="select-value">{placeholder}</div>;

    return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
});

vi.mock("@/lib/axiosInstance", () => ({
    default: {
        get: vi.fn(),
    },
}));

vi.mock("@/utils/debounce", () => ({
    useDebouncedCallback: (fn: any) => fn,
}));

describe("SQLiteViewer", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders basic structure", () => {
        const mockAxios = axiosInstance as unknown as { get: ReturnType<typeof vi.fn> };
        mockAxios.get.mockResolvedValue({ data: { tables: [], rows: [], columns: [], total: 0 } });

        render(<SQLiteViewer path="/test/database.db" />);

        expect(screen.getByText("Table:")).toBeInTheDocument();
        expect(screen.getByTestId("select")).toBeInTheDocument();
        expect(screen.getByTestId("data-table")).toBeInTheDocument();
    });
    it("loads tables, auto-selects the first, and fetches rows (maps to objects)", async () => {
        const mockAxios = axiosInstance as unknown as { get: ReturnType<typeof vi.fn> };

        mockAxios.get.mockReset();
        mockAxios.get.mockImplementation((url: string, opts?: any) => {
            if (url === "/workspace/sqlite-tables") {
                return Promise.resolve({ data: { tables: ["users", "orders"] } });
            }
            if (url === "/workspace/sqlite-rows") {
                // assert base params here (optional)
                const params = opts?.params;
                expect(params.get("path")).toBe("/test/database.db");
                expect(params.get("table")).toBe("users");
                expect(params.get("limit")).toBe("50");
                expect(params.get("offset")).toBe("0");

                return Promise.resolve({
                    data: {
                        table: "users",
                        columns: ["id", "name"],
                        rows: [
                            [1, "Alice"],
                            [2, "Bob"],
                        ],
                        total: 2,
                        limit: 50,
                        offset: 0,
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });

        render(<SQLiteViewer path="/test/database.db" />);

        // Wait for the table to be on screen
        await screen.findByTestId("data-table");

        // Wait until columns/rows/total reflect the fetched data
        await waitFor(() => {
            expect(screen.getByTestId("table-columns")).toHaveTextContent("2"); // id, name
            expect(screen.getByTestId("table-rows")).toHaveTextContent("2"); // Alice, Bob
            expect(screen.getByTestId("table-total")).toHaveTextContent("2");
            expect(screen.getByTestId("table-page")).toHaveTextContent("1");
            expect(screen.getByTestId("table-page-size")).toHaveTextContent("50");
        });

        // Sanity: we made both requests
        const urls = mockAxios.get.mock.calls.map(c => c[0]);
        expect(urls).toContain("/workspace/sqlite-tables");
        expect(urls).toContain("/workspace/sqlite-rows");
    });
    it("changing table via SelectItem refetches rows and keeps page at 1", async () => {
        const mockAxios = axiosInstance as unknown as { get: ReturnType<typeof vi.fn> };

        mockAxios.get.mockReset();
        mockAxios.get.mockImplementation((url: string, opts?: any) => {
            if (url === "/workspace/sqlite-tables") {
                return Promise.resolve({ data: { tables: ["users", "orders"] } });
            }
            if (url === "/workspace/sqlite-rows") {
                const params = opts?.params;
                const table = params.get("table");
                if (table === "users") {
                    return Promise.resolve({
                        data: {
                            table: "users",
                            columns: ["id", "name"],
                            rows: [[1, "Alice"]],
                            total: 1,
                            limit: 50,
                            offset: 0,
                        },
                    });
                }
                if (table === "orders") {
                    // Assert params for the table change
                    expect(params.get("path")).toBe("/test/database.db");
                    expect(params.get("limit")).toBe("50");
                    expect(params.get("offset")).toBe("0"); // stays page 1
                    return Promise.resolve({
                        data: {
                            table: "orders",
                            columns: ["id", "total"],
                            rows: [[10, 123.45]],
                            total: 1,
                            limit: 50,
                            offset: 0,
                        },
                    });
                }
            }
            return Promise.resolve({ data: {} });
        });

        render(<SQLiteViewer path="/test/database.db" />);

        // Wait initial render
        await screen.findByTestId("data-table");

        // Click the "orders" item in your mocked Select
        screen.getByTestId("select-item-orders").click();

        // Rows should reflect the new table
        await waitFor(() => {
            expect(screen.getByTestId("table-columns")).toHaveTextContent("2"); // id,total
            expect(screen.getByTestId("table-rows")).toHaveTextContent("1");
            expect(screen.getByTestId("table-page")).toHaveTextContent("1");
            expect(screen.getByTestId("table-page-size")).toHaveTextContent("50");
        });
    });

    it("typing in filter sends 'search' param", async () => {
        const mockAxios = axiosInstance as unknown as { get: ReturnType<typeof vi.fn> };

        mockAxios.get.mockReset();
        mockAxios.get.mockImplementation((url: string, opts?: any) => {
            if (url === "/workspace/sqlite-tables") {
                return Promise.resolve({ data: { tables: ["users"] } });
            }
            if (url === "/workspace/sqlite-rows") {
                const params = opts?.params;
                const search = params.get("search") || "";
                // Return rows filtered by 'search' (just echo back one row)
                if (search) {
                    expect(search).toBe("ali");
                    return Promise.resolve({
                        data: {
                            table: "users",
                            columns: ["id", "name"],
                            rows: [[1, "Alice"]],
                            total: 1,
                            limit: 50,
                            offset: 0,
                        },
                    });
                }
                // initial fetch
                return Promise.resolve({
                    data: {
                        table: "users",
                        columns: ["id", "name"],
                        rows: [
                            [1, "Alice"],
                            [2, "Bob"],
                        ],
                        total: 2,
                        limit: 50,
                        offset: 0,
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });

        render(<SQLiteViewer path="/test/database.db" />);

        await screen.findByTestId("data-table");

        // Type into the filter input of the mocked DataTable
        const filterInput = screen.getByTestId("table-filter") as HTMLInputElement;
        (filterInput as any).value = "ali";
        filterInput.dispatchEvent(new Event("input", { bubbles: true }));
        await waitFor(() => {
            expect(screen.getByTestId("table-rows")).toHaveTextContent("2");
            expect(screen.getByTestId("table-page")).toHaveTextContent("1");
            expect(screen.getByTestId("table-page-size")).toHaveTextContent("50");
        });
    });
});
