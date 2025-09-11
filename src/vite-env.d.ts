/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */

// eslint-disable-next-line @typescript-eslint/naming-convention
interface ImportMetaEnv {
    VS_PATH?: string;
    VITE_API_WS?: string;
    VITE_API_HTTP?: string;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
interface ImportMeta {
    readonly env: ImportMetaEnv;
}
