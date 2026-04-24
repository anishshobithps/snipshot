#!/usr/bin/env bun

import fs from "fs";
import path from "path";
import * as p from "@clack/prompts";
import { defineCommand, runMain } from "citty";
import ignore from "ignore";
import { snapshot } from "./snapshot";
import { bundledThemesInfo, bundledLanguagesInfo } from "shiki";

const CODE_EXTS = new Set<string>();
for (const lang of bundledLanguagesInfo) {
    CODE_EXTS.add("." + lang.id);
    for (const alias of lang.aliases ?? []) {
        CODE_EXTS.add("." + alias);
    }
}

function loadIgnorer(dir: string) {
    const ig = ignore();
    for (const name of [".gitignore", ".ignore"]) {
        const p = path.join(dir, name);
        if (fs.existsSync(p)) {
            ig.add(fs.readFileSync(p, "utf-8"));
        }
    }
    return ig;
}

function collectFiles(dir: string, base = dir, ig = loadIgnorer(base), depth = 0): string[] {
    if (depth > 4) return [];
    const results: string[] = [];
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
    for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const full = path.join(dir, entry.name);
        const rel = path.relative(base, full).replace(/\\/g, "/");
        if (ig.ignores(entry.isDirectory() ? rel + "/" : rel)) continue;
        if (entry.isDirectory()) {
            results.push(...collectFiles(full, base, ig, depth + 1));
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

    const borderRadiusStr = await p.text({
        message: "Border radius (px)",
        placeholder: "0",
        defaultValue: "0",
        validate: (v) => (v && isNaN(parseInt(v))) ? "Must be a number" : undefined,
    }) as string;
    if (p.isCancel(borderRadiusStr)) { p.cancel("Cancelled"); process.exit(0); }

    const showWindow = await p.confirm({ message: "Show window chrome?", initialValue: true }) as boolean;
    if (p.isCancel(showWindow)) { p.cancel("Cancelled"); process.exit(0); }

    const showFilename = await p.confirm({ message: "Show filename tab?", initialValue: true }) as boolean;
    if (p.isCancel(showFilename)) { p.cancel("Cancelled"); process.exit(0); }

    let filenameLabel: string | undefined;
    if (showFilename) {
        const labelStr = await p.text({
            message: "Custom filename label (leave blank to use actual filename)",
            placeholder: path.basename(file),
        }) as string;
        if (p.isCancel(labelStr)) { p.cancel("Cancelled"); process.exit(0); }
        filenameLabel = labelStr || undefined;
    }

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
    const borderRadius = parseInt(borderRadiusStr || "0");

    const spin = p.spinner();
    spin.start("Rendering…");

    try {
        const png = await snapshot({ code, file, theme, fontSize, padding, borderRadius, showWindow, showFilename, filenameLabel });
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
        "border-radius": { type: "string", description: "Border radius in px", default: "0" },
        width: { type: "string", description: "Fix output width in px (disables auto-sizing)" },
        height: { type: "string", description: "Fix output height in px (disables auto-sizing)" },
        "list-themes": { type: "boolean", description: "Print all available themes and exit" },
        "list-languages": { type: "boolean", description: "Print all supported languages and exit" },
        "filename-label": { type: "string", description: "Custom label shown in the filename tab" },
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
        const borderRadius = parseInt(args["border-radius"]);
        const width = args.width ? parseInt(args.width) : undefined;
        const height = args.height ? parseInt(args.height) : undefined;
        const showWindow = args.window;
        const showFilename = args.filename;
        const filenameLabel = args["filename-label"] as string | undefined;
        const output = args.output
            ? path.resolve(args.output)
            : path.join(process.cwd(), path.basename(file).replace(/\.[^/.]+$/, "") + ".png");

        const code = fs.readFileSync(file, "utf-8");

        p.intro("📸 snipshot");
        const spin = p.spinner();
        spin.start(`Rendering ${file} with theme "${theme}"…`);

        try {
            const png = await snapshot({ code, file, theme, fontSize, padding, borderRadius, width, height, showWindow, showFilename, filenameLabel });
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
