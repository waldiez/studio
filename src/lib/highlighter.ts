/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */

let _highlighter: Promise<HighlighterCore> | null = null;
import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";

import bash from "@shikijs/langs/bash";
import javascript from "@shikijs/langs/javascript";
import json from "@shikijs/langs/json";
import markdown from "@shikijs/langs/markdown";
import python from "@shikijs/langs/python";
import typescript from "@shikijs/langs/typescript";

import darkPlus from "@shikijs/themes/dark-plus";
import lightPlus from "@shikijs/themes/light-plus";

export function getShiki(): Promise<HighlighterCore> {
  if (!_highlighter) {
    _highlighter = createHighlighterCore({
      langs: [python, markdown, json, bash, javascript, typescript],
      themes: [darkPlus, lightPlus],
      engine: createOnigurumaEngine(import("shiki/wasm"))
    });
  }
  if (!_highlighter) {
    throw new Error("Could not initialize highlighter");
  }
  return _highlighter;
}

export async function codeToHtml(
  code: string,
  lang: string,
  theme: string,
): Promise<string> {
  const highlighter = await getShiki();
  return highlighter.codeToHtml(code, {
    lang,
    theme: theme === "light" ? lightPlus: darkPlus,
  });
}
