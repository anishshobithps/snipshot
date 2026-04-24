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
bun run build
bun link
```

After `bun link`, the `snipshot` command is available globally.

## Usage

### Interactive mode

Run without arguments and snipshot walks you through every option:

```bash
snipshot
```

It scans your current directory for code files, shows them in a scrollable list, then asks for theme, font size, padding, border radius, and output path. Press Enter to accept defaults.

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
  --list-themes        Print all 65 available themes and exit
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

snipshot ships all 65 themes from [Shiki](https://shiki.style). A few worth trying:

| Dark               | Light              |
| ------------------ | ------------------ |
| `tokyo-night`      | `github-light`     |
| `catppuccin-mocha` | `catppuccin-latte` |
| `rose-pine`        | `rose-pine-dawn`   |
| `dracula`          | `min-light`        |
| `github-dark`      | `solarized-light`  |

Run `snipshot --list-themes` to see all of them.

## How it works

1. Shiki resolves the theme and maps it to a Monaco-compatible token format
2. Puppeteer spins up a headless browser and loads Monaco Editor with your code
3. After Monaco finishes rendering, snipshot reads the actual content height from the editor API and resizes the container to fit exactly - no extra whitespace at the bottom
4. Width auto-sizes to the longest line so nothing gets cropped — or use `--width`/`--height` to lock the output to an exact pixel size
5. Puppeteer screenshots the element at 2x device pixel ratio and writes the PNG (1x when `--width`/`--height` are set so the output is exactly the requested size)
