import puppeteer from "puppeteer";
import { resolveLanguage, resolveTheme, type MonacoThemeData } from "./shiki-bridge";

export interface SnapshotOptions {
    code: string;
    file: string;
    theme?: string;
    fontSize?: number;
    padding?: number;
    borderRadius?: number;
    showWindow?: boolean;
    showFilename?: boolean;
}

export async function snapshot(opts: SnapshotOptions): Promise<Buffer> {
    const {
        code,
        file,
        theme: themeName = "tokyo-night",
        fontSize = 14,
        padding = 40,
        borderRadius = 0,
        showWindow = true,
        showFilename = true,
    } = opts;

    const lang = resolveLanguage(file);
    const resolved = await resolveTheme(themeName);
    const filename = file.split("/").pop() ?? file;
    const codeLines = code.split("\n");
    const lines = codeLines.length;

    const editorHeight = Math.min(Math.max(lines * (fontSize * 1.65) + 32, 120), 2400);
    const longestLine = Math.max(...codeLines.map((l) => l.length));
    // ~0.6 * fontSize is the approximate monospace char width; add line-number gutter (48px) + scrollbar padding
    const contentWidth = Math.ceil(longestLine * fontSize * 0.615) + 48 + 24;
    const totalWidth = Math.min(Math.max(contentWidth, 600), 1800);

    const html = buildHTML({
        code, lang, filename,
        theme: resolved,
        monacoTheme: resolved.monacoTheme,
        fontSize, editorHeight, totalWidth, padding, borderRadius, showWindow, showFilename,
    });

    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: totalWidth + padding * 2 + 200, height: 1200, deviceScaleFactor: 2 });
        await page.setContent(html, { waitUntil: "networkidle0" });

        await page.waitForFunction(
            "document.querySelector('.view-lines')?.children.length > 0",
            { timeout: 15000 }
        );
        await new Promise((r) => setTimeout(r, 800));

        // Fit the editor container to Monaco's actual content height to avoid bottom gap
        await page.evaluate(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const g = globalThis as any;
            const editor = g.monaco?.editor?.getEditors?.()[0];
            if (editor) {
                const actualHeight = editor.getContentHeight();
                const container = g.document.getElementById("editor-container");
                if (container) container.style.height = actualHeight + "px";
                editor.layout();
            }
        });

        const el = await page.$("#capture");
        if (!el) throw new Error("Capture element not found");
        const png = await el.screenshot({ type: "png" });
        return Buffer.from(png);
    } finally {
        await browser.close();
    }
}

type ResolvedTheme = Awaited<ReturnType<typeof resolveTheme>>;

function TrafficLights(): string {
    return `
        <div style="display:flex;gap:6px;">
            <div style="width:12px;height:12px;border-radius:50%;background:#ff5f57;"></div>
            <div style="width:12px;height:12px;border-radius:50%;background:#febc2e;"></div>
            <div style="width:12px;height:12px;border-radius:50%;background:#28c840;"></div>
        </div>`;
}

function FilenameTab({ filename, theme }: { filename: string; theme: ResolvedTheme }): string {
    return `<div style="font-size:12px;color:${theme.tabFg};background:${theme.bg};padding:4px 14px;border-radius:6px 6px 0 0;font-family:'Fira Code','Cascadia Code',monospace;">${filename}</div>`;
}

function Titlebar({ showWindow, showFilename, filename, theme }: {
    showWindow: boolean; showFilename: boolean; filename: string; theme: ResolvedTheme;
}): string {
    if (!showWindow) return "";
    return `
        <div style="background:${theme.titlebar};border-bottom:1px solid ${theme.border};padding:12px 16px;display:flex;align-items:center;gap:12px;flex-shrink:0;">
            ${TrafficLights()}
            ${showFilename ? FilenameTab({ filename, theme }) : ""}
        </div>`;
}

function EditorScript({ code, lang, monacoTheme, fontSize }: {
    code: string; lang: string; monacoTheme: MonacoThemeData; fontSize: number;
}): string {
    return `
<script src="https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.6/require.min.js"></script>
<script>
const THEME=${JSON.stringify(monacoTheme)};
const CODE=${JSON.stringify(code)};
const LANG=${JSON.stringify(lang)};
const FSIZE=${fontSize};
require.config({paths:{vs:'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs'}});
require(['vs/editor/editor.main'],function(){
    monaco.editor.defineTheme('sniptheme',THEME);
    monaco.editor.create(document.getElementById('editor-container'),{
        value:CODE,language:LANG,theme:'sniptheme',fontSize:FSIZE,
        fontFamily:"'Fira Code','Cascadia Code','JetBrains Mono',Consolas,monospace",
        fontLigatures:true,lineNumbers:'on',lineNumbersMinChars:3,
        renderLineHighlight:'none',minimap:{enabled:false},
        scrollbar:{vertical:'hidden',horizontal:'hidden'},overviewRulerLanes:0,
        readOnly:true,wordWrap:'off',padding:{top:16,bottom:20},
        scrollBeyondLastLine:false,contextmenu:false,renderWhitespace:'none',
        automaticLayout:false,cursorWidth:0,glyphMargin:false,
    });
});
</script>`;
}

function Page({ code, lang, filename, theme, monacoTheme, fontSize, editorHeight, totalWidth, padding, borderRadius, showWindow, showFilename }: {
    code: string; lang: string; filename: string;
    theme: ResolvedTheme; monacoTheme: MonacoThemeData;
    fontSize: number; editorHeight: number; totalWidth: number;
    padding: number; borderRadius: number; showWindow: boolean; showFilename: boolean;
}): string {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { background:transparent;width:${totalWidth + padding * 2}px; }
  #outer { padding:${padding}px;background:transparent;display:inline-block; }
  #capture { display:inline-flex;flex-direction:column;border-radius:${borderRadius}px;overflow:hidden;background:${theme.bg};width:${totalWidth}px; }
  #editor-container { width:${totalWidth}px;height:${editorHeight}px; }
  .monaco-editor .margin,.monaco-editor,.monaco-editor-background { background:${theme.bg} !important; }
</style>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs/editor/editor.main.min.css">
</head><body>
<div id="outer"><div id="capture">
  ${Titlebar({ showWindow, showFilename, filename, theme })}
  <div id="editor-container"></div>
</div></div>
${EditorScript({ code, lang, monacoTheme, fontSize })}
</body></html>`;
}

function buildHTML(opts: {
    code: string; lang: string; filename: string;
    theme: ResolvedTheme; monacoTheme: MonacoThemeData;
    fontSize: number; editorHeight: number; totalWidth: number;
    padding: number; borderRadius: number; showWindow: boolean; showFilename: boolean;
}): string {
    return Page(opts);
}
