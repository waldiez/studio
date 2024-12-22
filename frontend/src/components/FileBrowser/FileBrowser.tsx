import { useFileBrowser } from "@waldiez/studio/components/FileBrowser";
import { ActionButtons } from "@waldiez/studio/components/FileBrowser/ActionButtons";
import "@waldiez/studio/components/FileBrowser/FileBrowser.css";
import { Header } from "@waldiez/studio/components/FileBrowser/Header";
import { PathItem } from "@waldiez/studio/components/PathItem";
import { useSidebar } from "@waldiez/studio/components/Sidebar";

import React from "react";

export const FileBrowser: React.FC = () => {
    const {
        entries,
        loading,
        refresh,
        onNavigate,
        onCreate,
        onDelete,
        onRename,
        onUpload,
        onDownload,
        currentPath,
        error,
    } = useFileBrowser();
    const { isSidebarVisible, toggleSidebar } = useSidebar();
    const onNewFile = async () => {
        await onCreate("file");
    };
    const onNewFolder = async () => {
        await onCreate("folder");
    };
    return (
        <div
            className="file-browser"
            style={{
                width: isSidebarVisible ? "250px" : "60px",
            }}
        >
            <Header
                isSidebarVisible={isSidebarVisible}
                refresh={refresh}
                loading={loading}
                toggleSidebar={toggleSidebar}
            />
            <div className="file-browser-content">
                {isSidebarVisible && (
                    <>
                        {error && (
                            <p className="file-browser-error" data-testid="error">
                                {error}
                            </p>
                        )}
                        {entries.map(item => (
                            <PathItem
                                currentPath={currentPath}
                                key={item.path}
                                item={item}
                                onDelete={onDelete}
                                onRename={onRename}
                                onNavigate={onNavigate}
                                onDownload={onDownload}
                            />
                        ))}
                    </>
                )}
            </div>
            {isSidebarVisible && (
                <ActionButtons onNewFile={onNewFile} onNewFolder={onNewFolder} onUpload={onUpload} />
            )}
        </div>
    );
};
