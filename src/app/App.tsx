/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import Layout from "@/app/Layout";
import BottomPanel from "@/components/layout/BottomPanel";
import LeftSidebar from "@/components/layout/LeftSidebar";
import MainView from "@/components/layout/MainView";
import GlobalRunListener from "@/hooks/GlobalRunListener";
import KeyboardListener from "@/hooks/KeyboardListener";
import { ThemeProvider } from "@/theme/provider";

import { useEffect } from "react";

import { loader } from "@monaco-editor/react";

export function App() {
    useEffect(() => {
        loader.config({ paths: { vs: "vs" } });
    }, []);
    return (
        <ThemeProvider defaultTheme="dark">
            <GlobalRunListener />
            <KeyboardListener />
            <Layout left={<LeftSidebar />} main={<MainView />} bottom={<BottomPanel />} />{" "}
        </ThemeProvider>
    );
}
