/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import React, { ReactNode, useState } from "react";

import { SidebarContext } from "@waldiez/studio/components/Sidebar/useSidebar";

export const SidebarProvider: React.FC<{
    children: ReactNode;
    initialVisible?: boolean;
}> = ({ children, initialVisible = true }) => {
    const [isSidebarVisible, setIsSidebarVisible] = useState(initialVisible);

    const toggleSidebar = () => setIsSidebarVisible(prev => !prev);

    return (
        <SidebarContext.Provider value={{ isSidebarVisible, toggleSidebar }}>
            {children}
        </SidebarContext.Provider>
    );
};
