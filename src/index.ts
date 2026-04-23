#!/usr/bin/env bun

import fs from "fs";
import path from "path";
import * as p from "@clack/prompts";
import { defineCommand, runMain } from "citty";
import { snapshot } from "./snapshot";
import { bundledThemesInfo, bundledLanguagesInfo } from "shiki";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", "out", ".cache", "coverage"]);
const CODE_EXTS = new Set([
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
    ".py", ".rs", ".go", ".java", ".kt", ".swift",
    ".c", ".cpp", ".h", ".hpp", ".cs", ".rb", ".php",
    ".html", ".css", ".scss", ".sass", ".less",
    ".json", ".yaml", ".yml", ".toml", ".xml",
    ".sh", ".bash", ".zsh", ".fish", ".ps1",
    ".md", ".mdx", ".sql", ".graphql", ".vue", ".svelte",
]);

function collectFiles(dir: string, base = dir, depth = 0): string[] {
    if (depth > 4) return [];
    const results: string[] = [];
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
    for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const full = path.join(dir, entry.name);
        const rel = path.relative(base, full);
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) results.push(...collectFiles(full, base, depth + 1));
        } else if (CODE_EXTS.has(path.extname(entry.name).toLowerCase())) {
            results.push(rel);
        }
    }
    return results;
}

async function runInteractive(initialFile?: string) {
    p.intro("📸 snipshot");

    let file: string;
    if (initialFile) {
        file = initialFile;
    } else {
        const cwd = process.cwd();
        const found = collectFiles(cwd);

        let chosen: string;
        if (found.length === 0) {
            chosen = "__manual__";
        } else {
            chosen = await p.select({
                message: "File to snapshot",
                options: [
                    ...found.map((f) => ({ value: f, label: f })),
                    { value: "__manual__", label: "Type a path…" },
                ],
            }) as string;
            if (p.isCancel(chosen)) { p.cancel("Cancelled"); process.exit(0); }
        }

        if (chosen === "__manual__") {
            const typed = await p.text({
                message: "File path",
                placeholder: "src/index.ts",
                validate: (v) => {
                    if (!v) return "File path is required";
                    if (!fs.existsSync(v)) return `File not found: ${v}`;
                },
            }) as string;
            if (p.isCancel(typed)) { p.cancel("Cancelled"); process.exit(0); }
            file = typed;
        } else {
            file = path.join(cwd, chosen);
        }
    }

    if (!fs.existsSync(file)) { p.cancel(`File not found: ${file}`); process.exit(1); }

    const themeChoice = await p.select({
        message: "Theme",
        options: [
            ...bundledThemesInfo.map((t) => ({ value: t.id, label: t.displayName ?? t.id })),
        ],
        initialValue: "tokyo-night",
    }) as string;

    if (p.isCancel(themeChoice)) { p.cancel("Cancelled"); process.exit(0); }

    const theme = themeChoice;

    const fontSizeStr = await p.text({
        message: "Font size (px)",
        placeholder: "14",
        defaultValue: "14",
        validate: (v) => (v && isNaN(parseInt(v))) ? "Must be a number" : undefined,
    }) as string;
    if (p.isCancel(fontSizeStr)) { p.cancel("Cancelled"); process.exit(0); }

    const paddingStr = await p.text({
        message: "Padding (px)",
        placeholder: "40",
        defaultValue: "40",
        validate: (v) => (v && isNaN(parseInt(v))) ? "Must be a number" : undefined,
    }) as string;
    if (p.isCancel(paddingStr)) { p.cancel("Cancelled"); process.exit(0); }

    const showWindow = await p.confirm({ message: "Show window chrome?", initialValue: true }) as boolean;
    if (p.isCancel(showWindow)) { p.cancel("Cancelled"); process.exit(0); }

    const showFilename = await p.confirm({ message: "Show filename tab?", initialValue: true }) as boolean;
    if (p.isCancel(showFilename)) { p.cancel("Cancelled"); process.exit(0); }

    const defaultOutput = path.join(process.cwd(), path.basename(file).replace(/\.[^/.]+$/, "") + ".png");
    const outputStr = await p.text({
        message: "Output path",
        defaultValue: defaultOutput,
        placeholder: defaultOutput,
    }) as string;
    if (p.isCancel(outputStr)) { p.cancel("Cancelled"); process.exit(0); }

    const output = path.resolve(outputStr || defaultOutput);
    const code = fs.readFileSync(file, "utf-8");
    const fontSize = parseInt(fontSizeStr || "14");
    const padding = parseInt(paddingStr || "40");

    const spin = p.spinner();
    spin.start("Rendering…");

    try {
        const png = await snapshot({ code, file, theme, fontSize, padding, showWindow, showFilename });
        fs.writeFileSync(output, png);
        spin.stop(`Saved: ${output}`);
        p.outro("Done!");
    } catch (e: any) {
        spin.stop("Failed");
        p.cancel(e.message);
        process.exit(1);
    }
}

const main = defineCommand({
    meta: {
        name: "snipshot",
        description: "Aesthetic code screenshots via Monaco Editor + Shiki",
    },
    args: {
        file: { type: "positional", description: "Source file to snapshot", required: false },
        theme: { type: "string", description: "Shiki theme name", default: "tokyo-night" },
        "font-size": { type: "string", description: "Font size in px", default: "14" },
        padding: { type: "string", description: "Outer padding in px", default: "40" },
        output: { type: "string", description: "Output PNG path" },
        window: { type: "boolean", description: "Show window chrome", default: true },
        filename: { type: "boolean", description: "Show filename tab", default: true },
        interactive: { type: "boolean", description: "Force interactive mode", alias: "i", default: false },
        "list-themes": { type: "boolean", description: "Print all available themes and exit" },
        "list-languages": { type: "boolean", description: "Print all supported languages and exit" },
    },
    async run({ args }) {
        if (args["list-themes"]) {
            console.log(`\n${bundledThemesInfo.length} bundled themes:\n`);
            for (const t of bundledThemesInfo) console.log(`  ${t.id}`);
            console.log();
            return;
        }

        if (args["list-languages"]) {
            console.log(`\n${bundledLanguagesInfo.length} bundled languages:\n`);
            for (const l of bundledLanguagesInfo) console.log(`  ${l.id}`);
            console.log();
            return;
        }

        // Interactive mode: no file provided, or -i flag
        if (!args.file || args.interactive) {
            await runInteractive(args.file as string | undefined);
            return;
        }

        const file = args.file as string;
        if (!fs.existsSync(file)) {
            console.error(`❌ File not found: ${file}`);
            process.exit(1);
        }

        const theme = args.theme;
        const fontSize = parseInt(args["font-size"]);
        const padding = parseInt(args.padding);
        const showWindow = args.window;
        const showFilename = args.filename;
        const output = args.output
            ? path.resolve(args.output)
            : path.join(process.cwd(), path.basename(file).replace(/\.[^/.]+$/, "") + ".png");

        const code = fs.readFileSync(file, "utf-8");

        p.intro("📸 snipshot");
        const spin = p.spinner();
        spin.start(`Rendering ${file} with theme "${theme}"…`);

        try {
            const png = await snapshot({ code, file, theme, fontSize, padding, showWindow, showFilename });
            fs.writeFileSync(output, png);
            spin.stop(`Saved: ${output}`);
            p.outro("Done!");
        } catch (e: any) {
            spin.stop("Failed");
            p.cancel(e.message);
            process.exit(1);
        }
    },
});

runMain(main);
