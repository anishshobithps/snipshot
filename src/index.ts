#!/usr/bin/env bun

import fs from "fs";
import path from "path";
import { snapshot } from "./snapshot";
import { listThemes, listLanguages } from "./shiki-bridge";

const args = process.argv.slice(2);

if (args.includes("--list-themes")) {
    const themes = listThemes();
    console.log(`\n${themes.length} bundled themes:\n`);
    for (const t of themes) console.log(`  ${t}`);
    console.log();
    process.exit(0);
}

if (args.includes("--list-languages")) {
    const langs = listLanguages();
    console.log(`\n${langs.length} bundled languages:\n`);
    for (const l of langs) console.log(`  ${l}`);
    console.log();
    process.exit(0);
}

if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
snipshot — aesthetic code screenshots via Monaco Editor + Shiki

Usage:
  snipshot <file> [options]

Options:
  --theme <name>       Shiki theme name (default: tokyo-night)
  --font-size <n>      Font size in px (default: 14)
  --padding <n>        Outer padding in px (default: 40)
  --output <path>      Output PNG path (default: <basename>.png)
  --no-window          Hide macOS window chrome
  --no-filename        Hide filename tab in titlebar
  --list-themes        Print all ${listThemes().length} available Shiki themes and exit
  --list-languages     Print all ${listLanguages().length} supported languages and exit
  --help               Show this message

Examples:
  snipshot src/index.ts
  snipshot renderer.ts --theme dracula --font-size 16
  snipshot app.py --theme catppuccin-mocha --no-window
  snipshot main.rs --theme rose-pine --no-filename --output hero.png
  snipshot --list-themes
`);
    process.exit(0);
}

const file = args[0] as string;

if (!file || !fs.existsSync(file)) {
    console.error(`❌ File not found: ${file}`);
    process.exit(1);
}

function getArg(flag: string): string | undefined {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
}

const theme = getArg("--theme") ?? "tokyo-night";
const fontSize = parseInt(getArg("--font-size") ?? "14");
const padding = parseInt(getArg("--padding") ?? "40");
const showWindow = !args.includes("--no-window");
const showFilename = !args.includes("--no-filename");
const outputArg = getArg("--output");

const output = outputArg
    ? path.resolve(outputArg)
    : path.join(process.cwd(), path.basename(file).replace(/\.[^/.]+$/, "") + ".png");

const code = fs.readFileSync(file, "utf-8");

console.log(`📸 snipshot`);
console.log(`   file:     ${file}`);
console.log(`   theme:    ${theme}`);
console.log(`   font:     ${fontSize}px`);
console.log(`   window:   ${showWindow}`);
console.log(`   filename: ${showFilename}`);

async function run() {
    const png = await snapshot({ code, file, theme, fontSize, padding, showWindow, showFilename });
    fs.writeFileSync(output, png);
    console.log(`\n✅ Saved: ${output}`);
}

run().catch((e) => {
    console.error("❌ Failed:", e.message);
    process.exit(1);
});
