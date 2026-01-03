/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
import { DataTable } from "@/components/ui/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import axiosInstance from "@/lib/axiosInstance";
import { useDebouncedCallback } from "@/utils/debounce";
import type { SortingState } from "@tanstack/react-table";

import { useEffect, useMemo, useState } from "react";

type RowsPayload = {
    table: string;
    columns: string[];
    rows: any[][];
    total: number;
    limit: number;
    offset: number;
};

export default function SQLiteViewer({ path }: { path: string }) {
    const [tables, setTables] = useState<string[]>([]);
    const [active, setActive] = useState<string | null>(null);

    const [rows, setRows] = useState<Record<string, any>[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [total, setTotal] = useState(0);

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [sorting, setSorting] = useState<SortingState>([]);
    const [filter, setFilter] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setActive(null);
        setRows([]);
        setColumns([]);
        setTotal(0);
        axiosInstance
            .get<{ tables: string[] }>("/workspace/sqlite-tables", { params: { path } })
            .then(resp => {
                setTables(resp.data.tables);
                if (resp.data.tables.length) {
                    setActive(resp.data.tables[0]);
                }
            })
            .catch(() => setTables([]));
    }, [path]);

    const debouncedFetch = useDebouncedCallback((params: URLSearchParams) => {
        setLoading(true);
        axiosInstance
            .get<RowsPayload>("/workspace/sqlite-rows", { params })
            .then(resp => {
                const cols = resp.data.columns;
                setColumns(cols);
                setRows(
                    resp.data.rows.map(rowArr => {
                        const obj: Record<string, any> = {};
                        rowArr.forEach((val: any, i: number) => {
                            obj[cols[i]] = val;
                        });
                        return obj;
                    }),
                );
                setTotal(resp.data.total);
            })
            .finally(() => setLoading(false));
    }, 250);

    useEffect(() => {
        if (!active) {
            return;
        }

        const params = new URLSearchParams({
            path,
            table: active,
            limit: String(pageSize),
            offset: String((page - 1) * pageSize),
        });

        if (sorting[0]) {
            params.set("order_by", sorting[0].id);
            params.set("order_dir", sorting[0].desc ? "desc" : "asc");
        }
        if (filter.trim()) {
            params.set("search", filter.trim());
        }

        debouncedFetch(params);
    }, [active, path, page, pageSize, sorting, filter, debouncedFetch]);

    // dynamic columns
    const columnDefs = useMemo(
        () =>
            columns.map(col => ({
                id: col,
                header: col,
                accessorFn: (row: Record<string, any>) => row[col],
                enableSorting: true,
            })),
        [columns],
    );

    return (
        <div className="h-full w-full flex flex-col">
            {/* Table selector */}
            <div className="h-10 px-3 border-b border-[var(--border-color)] flex items-center gap-2">
                <span className="text-xs opacity-70">Table:</span>
                <Select
                    value={active ?? ""}
                    onValueChange={val => {
                        setActive(val || null);
                        setPage(1);
                    }}
                >
                    <SelectTrigger className="h-8 w-[200px] bg-transparent border border-[var(--border-color)]">
                        <SelectValue placeholder="Select a table" />
                    </SelectTrigger>
                    <SelectContent>
                        {tables.map(t => (
                            <SelectItem key={t} value={t}>
                                {t}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex-1 min-h-0">
                <DataTable
                    columns={columnDefs as any}
                    data={rows as any}
                    total={total}
                    page={page}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={n => {
                        setPageSize(n);
                        setPage(1);
                    }}
                    sorting={sorting}
                    onSortingChange={setSorting}
                    filter={filter}
                    onFilterChange={v => {
                        setFilter(v);
                        setPage(1);
                    }}
                    loading={loading}
                />
            </div>
        </div>
    );
}
