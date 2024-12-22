import { SidebarContext } from "@waldiez/studio/components/Sidebar/useSidebar";

import React, { ReactNode, useState } from "react";

export const SidebarProvider: React.FC<{ children: ReactNode; initialVisible?: boolean }> = ({
    children,
    initialVisible = true,
}) => {
    const [isSidebarVisible, setIsSidebarVisible] = useState(initialVisible);

    const toggleSidebar = () => setIsSidebarVisible(prev => !prev);

    return (
        <SidebarContext.Provider value={{ isSidebarVisible, toggleSidebar }}>
            {children}
        </SidebarContext.Provider>
    );
};
