/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import Layout from "@/app/Layout";
import BottomPanel from "@/components/layout/BottomPanel";
import LeftSidebar from "@/components/layout/LeftSidebar";
import MainView from "@/components/layout/MainView";
import { ThemeProvider } from "@/theme/provider";

import { useEffect } from "react";

import { loader } from "@monaco-editor/react";

import GlobalRunListener from "./GlobalRunListener";

export function App() {
    useEffect(() => {
        loader.config({ paths: { vs: "vs" } });
    }, []);
    return (
        <ThemeProvider defaultTheme="dark">
            <GlobalRunListener />
            <Layout left={<LeftSidebar />} main={<MainView />} bottom={<BottomPanel />} />{" "}
        </ThemeProvider>
    );
}
