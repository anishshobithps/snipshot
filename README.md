<p align="center">
  <img src="assets/header.png" alt="snipshot header" width="700" />
</p>

## Requirements

- [Bun](https://bun.sh) v1.0+
- [Node.js](https://nodejs.org) (Puppeteer needs it)

## Install

```bash
git clone https://github.com/anishshobithps/snipshot
cd snipshot
bun install
bun run link
```

After `bun run link`, the `snipshot` command is available globally.

## Usage

### Interactive mode

Run without arguments and snipshot walks you through every option:

```bash
snipshot
```

It scans your current directory for code files — using your `.gitignore` (and `.ignore` if present) to skip irrelevant paths — shows them in a scrollable list, then asks for theme, font size, padding, border radius, filename label, and output path. Press Enter to accept defaults.

### Direct mode

```bash
snipshot <file> [options]
```

```
Options:
  --theme <name>       Shiki theme (default: tokyo-night)
  --font-size <n>      Font size in px (default: 14)
  --padding <n>        Outer padding in px (default: 40)
  --border-radius <n>  Corner radius in px (default: 0)
  --width <n>          Fix output width in px (disables auto-sizing)
  --height <n>         Fix output height in px (disables auto-sizing)
  --output <path>      Output PNG path (default: <filename>.png)
  --filename-label <text>  Custom label shown in the filename tab
  --no-window          Hide the macOS window chrome
  --no-filename        Hide the filename tab
  --list-themes        Print all available themes and exit
  --list-languages     Print all supported languages and exit
  -i, --interactive    Force interactive mode
  --help               Show help
```

### Examples

```bash
# Screenshot with defaults
snipshot src/index.ts

# Different theme and font size
snipshot app.py --theme catppuccin-mocha --font-size 16

# No window chrome, custom output path
snipshot main.rs --no-window --output hero.png

# Custom filename label in the tab
snipshot src/index.ts --filename-label "✨ index.ts"

# Fixed size (e.g. for social/OG images)
snipshot README.md --width 1280 --height 640 --output cover.png

# See all themes
snipshot --list-themes
```

## Themes

snipshot ships all 235 languages and 65 themes from [Shiki](https://shiki.style). The full list of supported extensions and aliases is derived directly from Shiki's bundled language registry at runtime. A few themes worth trying:

| Dark               | Light              |
| ------------------ | ------------------ |
| `tokyo-night`      | `github-light`     |
| `catppuccin-mocha` | `catppuccin-latte` |
| `rose-pine`        | `rose-pine-dawn`   |
| `dracula`          | `min-light`        |
| `github-dark`      | `solarized-light`  |

Run `snipshot --list-themes` to see all of them.

## How it works

1. **File discovery** — in interactive mode, snipshot scans the working directory for files whose extension matches any language id or alias in Shiki's bundled registry. Paths matched by `.gitignore` or `.ignore` are skipped automatically.
2. **Theme resolution** — the chosen Shiki theme is converted into a Monaco-compatible token/color format by `shiki-bridge`, preserving exact foreground colors and font styles.
3. **Headless render** — Puppeteer launches a headless browser and loads a self-contained HTML page with Monaco Editor, the converted theme, and your code pre-loaded.
4. **Precise sizing** — in auto-size mode, snipshot reads Monaco's actual content height via the editor API and resizes the container to fit exactly (no trailing whitespace). Width auto-sizes to the longest line. Pass `--width`/`--height` to lock output to an exact pixel size instead.
5. **Screenshot** — Puppeteer captures the `#capture` element at 2× device pixel ratio (1× in fixed-size mode) and writes the PNG.
