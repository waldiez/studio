/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 - 2026 Waldiez & contributors
 */
type Props = {
    url: string;
    mime: string;
    className?: string;
    controls?: boolean; // for video/audio
    autoPlay?: boolean;
    loop?: boolean;
};

export default function MediaViewer({
    url,
    mime,
    className,
    controls = true,
    autoPlay = false,
    loop = false,
}: Props) {
    if (mime.startsWith("image/")) {
        return (
            <div className={className ?? "h-full w-full overflow-auto p-2 grid place-items-center"}>
                <img
                    src={url}
                    alt="media"
                    className="max-w-full max-h-full object-contain rounded border border-[var(--border-color)]"
                />
            </div>
        );
    }
    if (mime.startsWith("video/")) {
        return (
            <div className={className ?? "h-full w-full p-2"}>
                <video
                    src={url}
                    className="h-full w-full rounded border border-[var(--border-color)]"
                    controls={controls}
                    autoPlay={autoPlay}
                    loop={loop}
                />
            </div>
        );
    }
    if (mime.startsWith("audio/")) {
        return (
            <div className={className ?? "p-4"}>
                <audio src={url} controls className="w-full" />
            </div>
        );
    }
    // generic fallback
    return (
        <div className={className ?? "p-4 text-sm opacity-70"}>
            Unsupported media type: {mime}.{" "}
            <a href={url} download className="underline">
                Download
            </a>
        </div>
    );
}
