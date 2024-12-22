import { FileBrowserProvider } from "./components/FileBrowser/FileBrowserProvider";
import { FileBrowser } from "@waldiez/studio/components/FileBrowser";
import { SidebarProvider } from "@waldiez/studio/components/Sidebar";
import { WaldiezWrapper } from "@waldiez/studio/components/WaldiezWrapper";

import { useEffect } from "react";

export const App = () => {
    useEffect(() => {
        checkInitialBodyClass();
    }, []);
    return (
        <div className="app">
            <SidebarProvider>
                <FileBrowserProvider>
                    <FileBrowser />
                    <div className="waldiez-wrapper">
                        <WaldiezWrapper />
                    </div>
                </FileBrowserProvider>
            </SidebarProvider>
        </div>
    );
};

const checkInitialBodyClass = () => {
    // if the initial body class is not set,
    // set it based on the user's preference
    if (
        !document.body.classList.contains("waldiez-dark") &&
        !document.body.classList.contains("waldiez-light")
    ) {
        const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
        if (darkQuery.matches) {
            document.body.classList.add("waldiez-dark");
        } else {
            document.body.classList.add("waldiez-light");
        }
    }
};
