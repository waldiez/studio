/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2025 Waldiez & contributors
 */
import { DiMarkdown } from "react-icons/di";
import {
    FaFile,
    FaFileAlt,
    FaFileArchive,
    FaFileAudio,
    FaFileCode,
    FaFileImage,
    FaFilePdf,
    FaFileVideo,
    FaJava,
    FaJs,
    FaPhp,
    FaPython,
} from "react-icons/fa";
import { LuCodeXml } from "react-icons/lu";
import { SiJupyter, SiSqlite, SiYaml } from "react-icons/si";
import { VscJson } from "react-icons/vsc";

import logo from "@waldiez/react/dist/icon.svg";

/* eslint-disable complexity */
export const findFileIcon = (fileName: string) => {
    const extension = fileName.split(".").pop();
    const className = "path-item-icon size-4";
    const dataTestId = "file-icon";
    if (!extension) {
        return <FaFile className={className} />;
    }
    switch (extension) {
        case "waldiez":
        case "waldiezModel":
        case "waldiezSkill":
        case "waldiezAgent":
            return (
                <img
                    src={logo}
                    className={"path-item-icon size-5 waldiez-file"}
                    alt="logo"
                    title="Waldiez Flow"
                />
            );
        case "xml":
            return <LuCodeXml data-testid={dataTestId} className={className} title="XML" />;
        case "txt":
        case "doc":
        case "docx":
            return <FaFileAlt data-testid={dataTestId} className={className} title="Text" />;
        case "pdf":
            return <FaFilePdf data-testid={dataTestId} className={className} title="PDF" />;
        case "jpg":
        case "jpeg":
        case "png":
        case "gif":
        case "bmp":
        case "webp":
        case "svg":
        case "ico":
        case "tiff":
            return <FaFileImage data-testid={dataTestId} className={className} title="Image" />;
        case "mp3":
        case "wav":
        case "ogg":
        case "flac":
        case "aac":
        case "wma":
        case "m4a":
        case "aiff":
        case "alac":
            return <FaFileAudio data-testid={dataTestId} className={className} title="Audio" />;
        case "mp4":
        case "avi":
        case "mov":
        case "wmv":
        case "flv":
        case "mkv":
        case "webm":
        case "mpeg":
        case "3gp":
            return <FaFileVideo data-testid={dataTestId} className={className} title="Video" />;
        case "zip":
        case "rar":
        case "tar":
        case "gz":
        case "bz2":
        case "7z":
        case "xz":
            return <FaFileArchive data-testid={dataTestId} className={className} title="Archive" />;
        case "py":
        case "pyc":
        case "pyo":
        case "pyd":
            return <FaPython data-testid={dataTestId} className={className} title="Python" />;
        case "php":
            return <FaPhp data-testid={dataTestId} className={className} title="PHP" />;
        case "java":
        case "jar":
            return <FaJava data-testid={dataTestId} className={className} title="Java" />;
        case "ipynb":
            return <SiJupyter data-testid={dataTestId} className={className} title="Jupyter Notebook" />;
        case "json":
            return <VscJson data-testid={dataTestId} className={className} title="JSON" />;
        case "yaml":
        case "yml":
            return <SiYaml data-testid={dataTestId} className={className} title="YAML" />;
        case "md":
            return <DiMarkdown data-testid={dataTestId} className={className} title="Markdown" />;
        case "sqlite":
        case "db":
            return <SiSqlite data-testid={dataTestId} className={className} title="SQLite" />;
        case "js":
        case "jsx":
        case "mjs":
        case "cjs":
            return <FaJs data-testid={dataTestId} className={className} title="JavaScript" />;
        case "ts":
        case "tsx":
        case "html":
        case "css":
        case "scss":
        case "less":
        case "toml":
        case "ini":
        case "env":
        case "sh":
        case "bat":
        case "cmd":
        case "ps1":
        case "psm1":
        case "bash":
        case "zsh":
        case "fish":
        case "kt":
        case "kts":
        case "c":
        case "cpp":
        case "h":
        case "hpp":
        case "cs":
        case "go":
        case "rb":
        case "rs":
        case "clj":
        case "edn":
        case "scala":
        case "groovy":
        case "pl":
        case "pm":
            return <FaFileCode data-testid={dataTestId} className={className} title="Code" />;
        default:
            return <FaFile data-testid={dataTestId} className={className} title="File" />;
    }
};
