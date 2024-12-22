import logo from "@waldiez/studio/logo.svg";

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
import { SiJupyter } from "react-icons/si";
import { SiYaml } from "react-icons/si";
import { SiSqlite } from "react-icons/si";
import { VscJson } from "react-icons/vsc";

/* eslint-disable complexity */
export function findFileIcon(fileName: string) {
    const extension = fileName.split(".").pop();
    const className = "path-item-icon";
    if (!extension) {
        return <FaFile className={className} />;
    }
    switch (extension) {
        case "waldiez":
        case "waldiezModel":
        case "waldiezSkill":
        case "waldiezAgent":
            return <img src={logo} className={`${className} waldiez-file`} alt="logo" title="Waldiez Flow" />;
        case "xml":
            return <LuCodeXml className={className} title="XML" />;
        case "txt":
        case "doc":
        case "docx":
            return <FaFileAlt className={className} title="Text" />;
        case "pdf":
            return <FaFilePdf className={className} title="PDF" />;
        case "jpg":
        case "jpeg":
        case "png":
        case "gif":
        case "bmp":
        case "webp":
        case "svg":
        case "ico":
        case "tiff":
            return <FaFileImage className={className} title="Image" />;
        case "mp3":
        case "wav":
        case "ogg":
        case "flac":
        case "aac":
        case "wma":
        case "m4a":
        case "aiff":
        case "alac":
            return <FaFileAudio className={className} title="Audio" />;
        case "mp4":
        case "avi":
        case "mov":
        case "wmv":
        case "flv":
        case "mkv":
        case "webm":
        case "mpeg":
        case "3gp":
            return <FaFileVideo className={className} title="Video" />;
        case "zip":
        case "rar":
        case "tar":
        case "gz":
        case "bz2":
        case "7z":
        case "xz":
            return <FaFileArchive className={className} title="Archive" />;
        case "py":
        case "pyc":
        case "pyo":
        case "pyd":
            return <FaPython className={className} title="Python" />;
        case "php":
            return <FaPhp className={className} title="PHP" />;
        case "java":
        case "jar":
            return <FaJava className={className} title="Java" />;
        case "ipynb":
            return <SiJupyter className={className} title="Jupyter Notebook" />;
        case "json":
            return <VscJson className={className} title="JSON" />;
        case "yaml":
        case "yml":
            return <SiYaml className={className} title="YAML" />;
        case "md":
            return <DiMarkdown className={className} title="Markdown" />;
        case "sqlite":
        case "db":
            return <SiSqlite className={className} title="SQLite" />;
        case "js":
        case "jsx":
        case "mjs":
        case "cjs":
            return <FaJs className={className} title="JavaScript" />;
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
            return <FaFileCode className={className} title="Code" />;
        default:
            return <FaFile className={className} title="File" />;
    }
}
