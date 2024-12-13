import {
    FaFile,
    FaFileAlt,
    FaFileArchive,
    FaFileAudio,
    FaFileCode,
    FaFileImage,
    FaFilePdf,
    FaFileVideo
} from 'react-icons/fa';

import logo from '@waldiez/studio/logo.svg';

/* eslint-disable complexity */
export function findFileIcon(fileName: string) {
    const extension = fileName.split('.').pop();
    const className = 'path-item-icon';
    if (!extension) {
        return <FaFile className={className} />;
    }
    switch (extension) {
        case 'waldiez':
        case 'waldiezModel':
        case 'waldiezSkill':
        case 'waldiezAgent':
            return <img src={logo} className={`${className} waldiez-file`} alt="logo" />;
        case 'txt':
        case 'md':
        case 'doc':
        case 'docx':
            return <FaFileAlt className={className} />;
        case 'pdf':
            return <FaFilePdf className={className} />;
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
        case 'bmp':
        case 'webp':
        case 'svg':
        case 'ico':
        case 'tiff':
            return <FaFileImage className={className} />;
        case 'mp3':
        case 'wav':
        case 'ogg':
        case 'flac':
        case 'aac':
        case 'wma':
        case 'm4a':
        case 'aiff':
        case 'alac':
            return <FaFileAudio className={className} />;
        case 'mp4':
        case 'avi':
        case 'mov':
        case 'wmv':
        case 'flv':
        case 'mkv':
        case 'webm':
        case 'mpeg':
        case '3gp':
            return <FaFileVideo className={className} />;
        case 'zip':
        case 'rar':
        case 'tar':
        case 'gz':
        case 'bz2':
        case '7z':
        case 'xz':
            return <FaFileArchive className={className} />;
        case 'js':
        case 'ts':
        case 'jsx':
        case 'tsx':
        case 'html':
        case 'css':
        case 'scss':
        case 'less':
        case 'json':
        case 'xml':
        case 'yaml':
        case 'yml':
        case 'toml':
        case 'ini':
        case 'env':
        case 'sh':
        case 'bat':
        case 'cmd':
        case 'ps1':
        case 'psm1':
        case 'bash':
        case 'zsh':
        case 'fish':
        case 'php':
        case 'py':
        case 'pyc':
        case 'pyo':
        case 'pyd':
        case 'java':
        case 'jar':
        case 'kt':
        case 'kts':
        case 'c':
        case 'cpp':
        case 'h':
        case 'hpp':
        case 'cs':
        case 'go':
        case 'rb':
        case 'rs':
        case 'clj':
        case 'edn':
        case 'scala':
        case 'groovy':
        case 'pl':
        case 'pm':
            return <FaFileCode className={className} />;
        default:
            return <FaFile className={className} />;
    }
}
