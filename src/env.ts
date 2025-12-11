/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */

type WaldiezRuntimeConfig = {
    baseUrl: string; // e.g. "", "/studio"
    apiPrefix: string; // e.g. "/api", "/studio/api"
    wsPrefix: string; // e.g. "/ws", "/studio/ws"
    vsPrefix: string; // e.g. "/vs", "/studio/vs"
};

declare global {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    interface Window {
        __WALDIEZ_STUDIO_CONFIG__?: WaldiezRuntimeConfig;
    }
}

const cfg: WaldiezRuntimeConfig | undefined =
    typeof window !== "undefined" ? window.__WALDIEZ_STUDIO_CONFIG__ : undefined;

// Fallbacks mainly useful for tests or if backend route is missing
export const baseUrl = cfg?.baseUrl ?? "";
export const apiPrefix = cfg?.apiPrefix ?? "/api";
export const wsPrefix = cfg?.wsPrefix ?? "/ws";
export const vsPath = cfg?.vsPrefix ?? "/vs";
