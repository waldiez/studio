/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { findFileIcon } from "@waldiez/studio/components/PathItem/FileIcon";

describe("findFileIcon", () => {
    const className = "path-item-icon";
    const testCases = [
        { fileName: "file.waldiez", expectedTitle: "Waldiez Flow" },
        { fileName: "file.xml", expectedTitle: "XML" },
        { fileName: "file.txt", expectedTitle: "Text" },
        { fileName: "file.pdf", expectedTitle: "PDF" },
        { fileName: "file.jpg", expectedTitle: "Image" },
        { fileName: "file.mp3", expectedTitle: "Audio" },
        { fileName: "file.mp4", expectedTitle: "Video" },
        { fileName: "file.zip", expectedTitle: "Archive" },
        { fileName: "file.py", expectedTitle: "Python" },
        { fileName: "file.php", expectedTitle: "PHP" },
        { fileName: "file.java", expectedTitle: "Java" },
        { fileName: "file.ipynb", expectedTitle: "Jupyter Notebook" },
        { fileName: "file.json", expectedTitle: "JSON" },
        { fileName: "file.yaml", expectedTitle: "YAML" },
        { fileName: "file.md", expectedTitle: "Markdown" },
        { fileName: "file.sqlite", expectedTitle: "SQLite" },
        { fileName: "file.js", expectedTitle: "JavaScript" },
        { fileName: "file.ts", expectedTitle: "Code" },
        { fileName: "file.unknown", expectedTitle: "File" },
    ];
    testCases.forEach(({ fileName, expectedTitle }) => {
        it(`should render correct icon for ${fileName} with title "${expectedTitle}"`, () => {
            const { container } = render(findFileIcon(fileName));
            const icon = container.querySelector(`.${className}`);
            expect(icon).toBeTruthy();
            const titleElement = screen.getByTitle(expectedTitle);
            expect(titleElement).toBeTruthy();
        });
    });
});
