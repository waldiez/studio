/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { create } from "zustand";

export type DockTab = "run" | "terminal";

type LayoutState = {
    // horizontal: [left, right] (%)
    hSizes: [number, number];
    // vertical inside right: [main(top), dock(bottom)] (%)
    vSizes: [number, number];

    leftCollapsed: boolean;
    bottomCollapsed: boolean;

    dockTab: DockTab;

    setDockTab: (t: DockTab) => void;

    setHorizontal: (sizes: number[]) => void;
    setVertical: (sizes: number[]) => void;

    setLeftCollapsed: (v: boolean) => void;
    setBottomCollapsed: (v: boolean) => void;

    resetLayout: () => void;
};

const H_KEY = "ide.layout.hSizes";
const V_KEY = "ide.layout.vSizes";
const L_KEY = "ide.layout.leftCollapsed";
const B_KEY = "ide.layout.bottomCollapsed";
const D_KEY = "ide.layout.dockTab";

function read<T>(k: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(k);
        if (!raw) {
            return fallback;
        }
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}
function write<T>(k: string, v: T) {
    try {
        localStorage.setItem(k, JSON.stringify(v));
    } catch {
        //
    }
}

export const useLayout = create<LayoutState>((set, _get) => ({
    hSizes: read(H_KEY, [22, 78]) as [number, number],
    vSizes: read(V_KEY, [70, 30]) as [number, number],

    leftCollapsed: read(L_KEY, false),
    bottomCollapsed: read(B_KEY, false),

    dockTab: read(D_KEY, "run"),

    setDockTab: t => {
        write(D_KEY, t);
        set({ dockTab: t });
    },

    setHorizontal: sizes => {
        const v: [number, number] = [sizes[0] ?? 22, sizes[1] ?? 78];
        write(H_KEY, v);
        set({ hSizes: v });
    },

    setVertical: sizes => {
        const v: [number, number] = [sizes[0] ?? 70, sizes[1] ?? 30];
        write(V_KEY, v);
        set({ vSizes: v });
    },

    setLeftCollapsed: val => {
        write(L_KEY, val);
        set({ leftCollapsed: val });
    },

    setBottomCollapsed: val => {
        write(B_KEY, val);
        set({ bottomCollapsed: val });
    },

    resetLayout: () => {
        const h: [number, number] = [22, 78];
        const v: [number, number] = [70, 30];
        write(H_KEY, h);
        write(V_KEY, v);
        write(L_KEY, false);
        write(B_KEY, false);
        set({
            hSizes: h,
            vSizes: v,
            leftCollapsed: false,
            bottomCollapsed: false,
        });
    },
}));
