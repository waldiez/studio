import { createContext, useContext } from "react";

type SidebarContextType = {
    isSidebarVisible: boolean;
    toggleSidebar: () => void;
};

export const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const useSidebar = (): SidebarContextType => {
    const context = useContext(SidebarContext);
    if (!context) {
        throw new Error("useSidebar must be used within a SidebarProvider");
    }
    return context;
};
