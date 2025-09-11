/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    type ColumnDef,
    type OnChangeFn,
    type SortingState,
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

export type DataTableProps<TData, TValue> = {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    total: number;
    page: number; // 1-based
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
    sorting: SortingState;
    onSortingChange: OnChangeFn<SortingState>;
    filter: string;
    onFilterChange: (value: string) => void;
    loading?: boolean;
};

export function DataTable<TData, TValue>({
    columns,
    data,
    total,
    page,
    pageSize,
    onPageChange,
    onPageSizeChange,
    sorting,
    onSortingChange,
    filter,
    onFilterChange,
    loading,
}: DataTableProps<TData, TValue>) {
    const table = useReactTable({
        data,
        columns,
        state: { sorting },
        onSortingChange,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(), // client-side sort for the current page (server still drives real order)
        manualSorting: true, // we drive sort on the server
    });

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return (
        <div className="flex h-full w-full flex-col">
            {/* Toolbar */}
            <div className="flex items-center gap-2 p-2 border-b border-[var(--border-color)]">
                <Input
                    className="h-8 w-64"
                    placeholder="Filter…"
                    value={filter}
                    onChange={e => onFilterChange(e.target.value)}
                />
                <div className="ml-auto text-xs opacity-70">
                    {loading ? "Loading…" : `${total.toLocaleString()} rows`}
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 min-h-0 overflow-auto">
                <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0 bg-[var(--primary-alt-color)]/60 z-10">
                        {table.getHeaderGroups().map(hg => (
                            <tr key={hg.id}>
                                {hg.headers.map(h => (
                                    <th
                                        key={h.id}
                                        className="border border-[var(--border-color)] px-2 py-1 text-left select-none cursor-pointer"
                                        onClick={h.column.getToggleSortingHandler()}
                                    >
                                        {flexRender(h.column.columnDef.header, h.getContext())}
                                        {{
                                            asc: " ▲",
                                            desc: " ▼",
                                        }[h.column.getIsSorted() as "asc" | "desc"] ?? null}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody>
                        {data.map((row, i) => (
                            <tr key={i} className="odd:bg-black/0 even:bg-black/5 dark:even:bg-white/5">
                                {table.getAllColumns().map(col => {
                                    const cell = (row as any)[col.id];
                                    return (
                                        <td
                                            key={col.id}
                                            className="border border-[var(--border-color)] px-2 py-1 align-top"
                                        >
                                            {String(cell ?? "NULL")}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                        {!data.length && (
                            <tr>
                                <td colSpan={columns.length} className="px-3 py-6 text-center opacity-60">
                                    No rows
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="h-12 border-t border-[var(--border-color)] px-3 flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => onPageChange(1)} disabled={page <= 1}>
                    « First
                </Button>
                <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                >
                    ‹ Prev
                </Button>
                <span className="text-xs opacity-70">
                    Page {page} / {totalPages}
                </span>
                <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages}
                >
                    Next ›
                </Button>
                <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onPageChange(totalPages)}
                    disabled={page >= totalPages}
                >
                    Last »
                </Button>

                <div className="flex items-center gap-2">
                    <span className="text-xs opacity-70">Rows per page:</span>
                    <Select
                        value={String(pageSize)}
                        onValueChange={val => {
                            onPageSizeChange(Number(val));
                        }}
                    >
                        <SelectTrigger className="h-8 w-[80px] bg-transparent border border-[var(--border-color)]">
                            <SelectValue placeholder={String(pageSize)} />
                        </SelectTrigger>
                        <SelectContent>
                            {[10, 25, 50, 100].map(n => (
                                <SelectItem key={n} value={String(n)}>
                                    {n}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    );
}
