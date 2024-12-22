import React from "react";

type StyleMap = {
    [key: string]: React.CSSProperties;
};

const ANSI_STYLES: StyleMap = {
    "0": {}, // Reset
    "1": { fontWeight: "bold" },
    "3": { fontStyle: "italic" },
    "4": { textDecoration: "underline" },
    "7": { filter: "invert(100%)" },
    "9": { textDecoration: "line-through" },
    "22": { fontWeight: "normal" },
    "23": { fontStyle: "normal" },
    "24": { textDecoration: "none" },
    "27": { filter: "none" },
    "29": { textDecoration: "none" },
    // Foreground colors
    "30": { color: "var(--ansi-black)" },
    "31": { color: "var(--ansi-red)" },
    "32": { color: "var(--ansi-green)" },
    "33": { color: "var(--ansi-yellow)" },
    "34": { color: "var(--ansi-blue)" },
    "35": { color: "var(--ansi-magenta)" },
    "36": { color: "var(--ansi-cyan)" },
    "37": { color: "var(--ansi-white)" },
    "90": { color: "var(--ansi-bright-yellow)" },
    // Background colors can also use similar variables
    "40": { backgroundColor: "var(--ansi-black)" },
    "41": { backgroundColor: "var(--ansi-red)" },
    "42": { backgroundColor: "var(--ansi-green)" },
    "43": { backgroundColor: "var(--ansi-yellow)" },
    "44": { backgroundColor: "var(--ansi-blue)" },
    "45": { backgroundColor: "var(--ansi-magenta)" },
    "46": { backgroundColor: "var(--ansi-cyan)" },
    "47": { backgroundColor: "var(--ansi-white)" },
};

// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\u001b\[([0-9;]+)m(.*?)(?=\u001b\[|$)|\u001b\[([0-9;]+)m/g;

type AnsiSegment = {
    text: string;
    style: React.CSSProperties;
};

const parseAnsi = (text: string): AnsiSegment[] => {
    const segments: AnsiSegment[] = [];
    let lastIndex = 0;
    let currentStyle: React.CSSProperties = {}; // Track cumulative styles

    text.replace(ANSI_REGEX, (match, codes, content = "", standaloneCodes, offset) => {
        // Add unstyled text before this ANSI match
        if (lastIndex < offset) {
            const unstyledText = text.slice(lastIndex, offset);
            if (unstyledText.trim()) {
                segments.push({ text: unstyledText, style: { ...currentStyle } });
            }
        }

        // Handle ANSI codes (including standalone escape sequences)
        const activeCodes = codes || standaloneCodes || "";
        activeCodes.split(";").forEach((code: string) => {
            if (code === "0") {
                // Reset styles on '0'
                currentStyle = {};
            } else if (ANSI_STYLES[code]) {
                // Merge new styles
                currentStyle = { ...currentStyle, ...ANSI_STYLES[code] };
            }
        });

        // Add styled text only if content exists
        if (content.trim()) {
            segments.push({ text: content, style: { ...currentStyle } });
        }

        lastIndex = offset + match.length;
        return "";
    });

    // Add remaining unstyled text after the last ANSI match
    if (lastIndex < text.length) {
        const remainingText = text.slice(lastIndex);
        if (remainingText.trim()) {
            segments.push({ text: remainingText, style: { ...currentStyle } });
        }
    }

    return segments;
};

type AnsiRendererProps = {
    text: string;
};

export const AnsiRenderer: React.FC<AnsiRendererProps> = ({ text }) => {
    const segments = parseAnsi(text);

    return (
        <span>
            {segments.map((segment, index) => (
                <span key={index} style={segment.style}>
                    {segment.text}
                </span>
            ))}
        </span>
    );
};
