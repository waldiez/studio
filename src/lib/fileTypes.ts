/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
export type ViewerKind = "code" | "notebook" | "mermaid" | "markdown" | "media" | "binary";
export type FileRoute = { kind: ViewerKind; language?: string };

export const routeByExt: Record<string, FileRoute> = {
  ".py": { kind: "code", language: "python" },
  ".ts": { kind: "code", language: "typescript" },
  ".js": { kind: "code", language: "javascript" },
  ".json": { kind: "code", language: "json" },
  ".md": { kind: "markdown" },
  ".mmd": { kind: "mermaid" },
  ".ipynb": { kind: "notebook" },
  ".html": { kind: "code", language: "html" },
  ".css": { kind: "code", language: "css" },
  ".sh": { kind: "code", language: "bash" },
  ".bsh": { kind: "code", language: "bash" },
  ".zsh": { kind: "code", language: "bash" },
  ".ps1": { kind: "code", language: "pwsh" },
  ".png": { kind: "media" },
  ".jpg": { kind: "media" },
  ".jpeg": { kind: "media" },
  ".gif": { kind: "media" },
  ".webp": { kind: "media" },
  ".mp4": { kind: "media" },
  ".webm": { kind: "media" },
  ".ogg": { kind: "media" },
  ".wav": { kind: "media" },
  ".svg": { kind: "media" },
  ".waldiez": { kind: "code", language: "waldiez" }
};

// eslint-disable-next-line max-statements, complexity
export const guessLanguage = (name: string): string => {
  const n = name.toLowerCase();
  if (n.endsWith(".py")) {return "python";}
  if (n.endsWith(".ts")) {return "typescript";}
  if (n.endsWith(".tsx")) {return "typescript";}
  if (n.endsWith(".js")) {return "javascript";}
  if (n.endsWith(".jsx")) {return "javascript";}
  if (n.endsWith(".json")) {return "json";}
  if (n.endsWith(".md")) {return "markdown";}
  if (n.endsWith(".mmd")) {return "markdown";}
  if (n.endsWith(".css")) {return "css";}
  if (n.endsWith(".html")) {return "html";}
  if (n.endsWith(".xml")) {return "xml";}
  if (n.endsWith(".yml") || n.endsWith(".yaml")) {return "yaml";}
  if (n.endsWith(".toml")) {return "toml";}
  if (n.endsWith(".ini")) {return "ini";}
  if (n.endsWith(".sh")) {return "bash";}
  if (n.endsWith(".bash")) {return "bash";}
  if (n.endsWith(".bsh")) {return "bash";}
  if (n.endsWith(".zsh")) {return "bash";}
  if (n.endsWith(".bsh")) {return "bash";}
  if (n.endsWith(".ps1")) {return "pwsh";}
  if (n.endsWith(".waldiez")) {return "waldiez";}
  return "plaintext";
};

export function routeFile(name: string): FileRoute {
  const ext = name.toLowerCase().slice(name.lastIndexOf("."));
  console.log(ext, routeByExt[ext]);
  return routeByExt[ext] ?? { kind: "binary" };
}
