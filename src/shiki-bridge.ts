import {
    createHighlighter,
    bundledLanguagesInfo,
    bundledThemesInfo,
    type BundledLanguage,
    type BundledTheme,
} from "shiki";

const aliasToId = new Map<string, BundledLanguage>();

for (const lang of bundledLanguagesInfo) {
    aliasToId.set(lang.id, lang.id as BundledLanguage);
    for (const alias of lang.aliases ?? []) {
        if (!aliasToId.has(alias)) {
            aliasToId.set(alias, lang.id as BundledLanguage);
        }
    }
}

export function resolveLanguage(filename: string): BundledLanguage | "plaintext" {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (!ext) return "plaintext";
    return aliasToId.get(ext) ?? "plaintext";
}

export interface MonacoThemeData {
    base: "vs" | "vs-dark";
    inherit: boolean;
    rules: MonacoTokenRule[];
    colors: Record<string, string>;
}

interface MonacoTokenRule {
    token: string;
    foreground?: string;
    fontStyle?: string;
}

export interface ResolvedTheme {
    monacoTheme: MonacoThemeData;
    bg: string;
    fg: string;
    type: string;
    titlebar: string;
    border: string;
    tabFg: string;
}

type TextMateSetting = {
    scope?: string | string[];
    settings: { foreground?: string; fontStyle?: string };
};

function settingsToRules(entry: TextMateSetting): MonacoTokenRule[] {
    if (!entry.scope) return [];
    const scopes = Array.isArray(entry.scope) ? entry.scope : [entry.scope];
    return scopes.map((scope) => ({
        token: scope,
        ...(entry.settings.foreground && { foreground: entry.settings.foreground.replace(/^#/, "") }),
        ...(entry.settings.fontStyle !== undefined && { fontStyle: entry.settings.fontStyle }),
    }));
}

function darken(color: string, amount = 0.07): string {
    const c = color.replace(/^#/, "");
    const adjust = (channel: string) =>
        Math.max(0, parseInt(channel, 16) - Math.round(255 * amount))
            .toString(16)
            .padStart(2, "0");
    return `#${adjust(c.slice(0, 2))}${adjust(c.slice(2, 4))}${adjust(c.slice(4, 6))}`;
}

const MONACO_COLOR_KEYS = [
    "editor.background",
    "editor.foreground",
    "editor.lineHighlightBackground",
    "editor.selectionBackground",
    "editor.inactiveSelectionBackground",
    "editor.selectionHighlightBackground",
    "editor.wordHighlightBackground",
    "editor.wordHighlightStrongBackground",
    "editor.findMatchBackground",
    "editor.findMatchHighlightBackground",
    "editorLineNumber.foreground",
    "editorLineNumber.activeForeground",
    "editorCursor.foreground",
    "editorIndentGuide.background1",
    "editorIndentGuide.activeBackground1",
    "editorBracketHighlight.foreground1",
    "editorBracketHighlight.foreground2",
    "editorBracketHighlight.foreground3",
    "editorBracketMatch.background",
    "editorBracketMatch.border",
    "editorError.foreground",
    "editorWarning.foreground",
    "editorInfo.foreground",
    "editorGhostText.foreground",
    "editorWhitespace.foreground",
    "editorRuler.foreground",
    "scrollbarSlider.background",
    "scrollbarSlider.hoverBackground",
    "scrollbarSlider.activeBackground",
];

const cache = new Map<string, ResolvedTheme>();

export async function resolveTheme(themeName: string): Promise<ResolvedTheme> {
    if (cache.has(themeName)) return cache.get(themeName)!;

    if (!bundledThemesInfo.some((t) => t.id === themeName)) {
        throw new Error(`Unknown theme "${themeName}". Run \`snipshot --list-themes\` to see available themes.`);
    }

    const hl = await createHighlighter({ themes: [themeName as BundledTheme], langs: [] });
    const theme = hl.getTheme(themeName as BundledTheme);
    const colors = theme.colors ?? {};

    const rules = (theme.settings as TextMateSetting[]).flatMap(settingsToRules);

    const monacoColors: Record<string, string> = {};
    for (const key of MONACO_COLOR_KEYS) {
        if (colors[key]) monacoColors[key] = colors[key];
    }

    const bg = theme.bg ?? colors["editor.background"] ?? "#1e1e1e";
    const fg = theme.fg ?? colors["editor.foreground"] ?? "#d4d4d4";

    const resolved: ResolvedTheme = {
        monacoTheme: {
            base: theme.type === "light" ? "vs" : "vs-dark",
            inherit: false,
            rules,
            colors: monacoColors,
        },
        bg,
        fg,
        type: theme.type ?? "dark",
        titlebar:
            colors["activityBar.background"] ??
            colors["editorGroupHeader.tabsBackground"] ??
            colors["tab.inactiveBackground"] ??
            darken(bg),
        border:
            colors["editorGroup.border"] ??
            colors["panel.border"] ??
            colors["tab.border"] ??
            darken(bg, 0.15),
        tabFg:
            colors["editorLineNumber.activeForeground"] ??
            colors["tab.activeForeground"] ??
            fg,
    };

    cache.set(themeName, resolved);
    return resolved;
}
