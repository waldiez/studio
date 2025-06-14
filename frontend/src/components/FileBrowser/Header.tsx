/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import React from "react";
import { FaBars, FaSpinner, FaSyncAlt } from "react-icons/fa";

export const Header: React.FC<{
    isSidebarVisible: boolean;
    refresh: () => Promise<void>;
    loading: boolean;
    toggleSidebar: () => void;
}> = ({ isSidebarVisible, refresh, loading, toggleSidebar }) => (
    <div
        className="file-browser-toggle"
        style={{
            justifyContent: isSidebarVisible ? "space-between" : "center",
        }}
    >
        {isSidebarVisible && (
            <div className="file-browser-header">
                <h3>Workspace</h3>
                <button
                    onClick={refresh}
                    disabled={loading}
                    title="Refresh"
                    data-testid="refresh-button"
                    aria-label="Refresh"
                    className="file-browser-refresh"
                    style={{
                        cursor: loading ? "not-allowed" : "pointer",
                        opacity: loading ? 0.7 : 1,
                    }}
                >
                    {loading ? (
                        <FaSpinner aria-hidden="true" className="spinner" />
                    ) : (
                        <FaSyncAlt aria-hidden="true" />
                    )}
                </button>
            </div>
        )}
        <FaBars
            role="button"
            className="file-browser-toggle-icon"
            onClick={toggleSidebar}
            aria-hidden="true"
        />
    </div>
);
