# EarthMC Dynmap+ Cross-Browser Fork

This repository is a maintained fork of EarthMC Dynmap+ with first-class support for both Chromium-based browsers and Firefox.

If you are new to browser extension development, the short version is:

1. Install Node.js.
2. Run `npm install`.
3. Build the extension with `npm run extension`.
4. Load the built extension from `dist/chromium/` or `dist/firefox/`.
5. Run the automated tests with `npm run test:e2e`.

## What this project does

This extension adds extra tools and map overlays to the EarthMC Dynmap website, including:

- extra map modes such as alliances and meganations
- archive mode for older claim data
- town, nation, and resident lookup
- extra sidebar controls
- country borders and chunk overlays
- screenshot support

The same shared source code is packaged for:

- Chromium-based browsers
- Firefox
- a userscript fallback

## Before you start

You need:

- Node.js 18 or newer
- npm
- at least one supported browser installed locally

If you only want to build the extension, that is enough.

If you also want to run the end-to-end browser tests, read the `Automated tests` section below because Chromium has one important setup rule.

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Build the extension

```bash
npm run extension
```

That creates:

- `dist/chromium/`
- `dist/firefox/`
- `dist/emc-dynmapplus-chromium.zip`
- `dist/emc-dynmapplus-firefox.xpi`

If you only want one browser target:

```bash
npm run extension:chromium
npm run extension:firefox
```

If you want the userscript:

```bash
npm run userscript
```

## Load the extension in your browser

### Chromium

1. Build the Chromium target with `npm run extension:chromium`.
2. Open `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the `dist/chromium` folder.

### Firefox

1. Build the Firefox target with `npm run extension:firefox`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click `Load Temporary Add-on...`.
4. Select `dist/firefox/manifest.json`.

Note:

- Firefox temporary add-ons are removed when Firefox fully restarts.
- That is normal during local development.

## Build commands

Available scripts:

- `npm run userscript`
- `npm run extension`
- `npm run extension:chromium`
- `npm run extension:firefox`
- `npm run build`

What they do:

- `userscript`: builds `dist/emc-dynmapplus.user.js`
- `extension`: builds both browser targets
- `build`: builds both the userscript and both extension targets

## Automated tests

The Selenium-based end-to-end tests live in `scripts/e2e/`.

Main commands:

- `npm run test:e2e`
- `npm run test:e2e:chromium`
- `npm run test:e2e:firefox`
- `npm run test:e2e:archive`
- `npm run test:e2e:archive:chromium`
- `npm run test:e2e:archive:firefox`

Legacy compatibility aliases still work:

- `npm run check:archive:chromium`
- `npm run check:archive:firefox`

You can also call the runner directly:

```bash
node scripts/e2e/run.mjs --list
node scripts/e2e/run.mjs --browser chromium
node scripts/e2e/run.mjs --browser firefox --test archive
```

### Headless mode

By default, the e2e runner is headful.

To request headless mode for all selected browsers:

```bash
npm run test:e2e --headless
```

You can also use the direct runner form:

```bash
node scripts/e2e/run.mjs --headless
```

Important note:

- Firefox supports the new headless flag normally.
- Chromium extension tests are most reliable headful.
- On current Chrome/Chromium builds, headless extension behavior is not a reliable signal that the unpacked extension actually loaded.

### Chromium test requirement

This is the most important testing note in the whole repository:

Extension-based Selenium tests for Chromium do not work reliably with branded Google Chrome 137+ because those builds ignore `--load-extension`.

For Chromium e2e tests, use one of these instead:

- Chromium
- Chrome for Testing

The test launcher will automatically prefer:

1. explicit environment variable paths
2. installed Chromium
3. a local Chrome for Testing fallback under `.tools/`

If the launcher only finds branded Google Chrome, it now fails with a clear error instead of silently starting a browser without the extension loaded.

### Local `.tools/` fallback

The `.tools/` folder is for local browser binaries only.

It is intentionally gitignored and should not be committed.

If you want to use Chrome for Testing as a local fallback, place binaries like this:

```text
.tools/
  chrome-win64/
    chrome.exe
  chromedriver-win64/
    chromedriver.exe
```

That setup is especially useful on Windows if you do not have Chromium installed.

### Browser and driver prerequisites

Before running e2e tests:

1. Build the correct extension target first.
2. Make sure the browser exists locally.
3. Make sure the matching driver exists locally, or allow Selenium Manager to resolve one.

Examples:

- `npm run extension:chromium` before Chromium tests
- `npm run extension:firefox` before Firefox tests

### Environment variables

Browser paths:

- Chromium: `CHROMIUM_BINARY`, `CHROMIUM_BINARY_PATH`, `CHROME_BINARY`, `CHROME_BINARY_PATH`
- Firefox: `FIREFOX_BINARY`, `FIREFOX_BINARY_PATH`

Driver paths:

- Chromium: `CHROMEDRIVER`, `CHROMEDRIVER_PATH`
- Firefox: `GECKODRIVER`, `GECKODRIVER_PATH`

Optional test behavior:

- `CHROMIUM_HEADLESS=1` forces Chromium headless mode
- `FIREFOX_HEADLESS=1` forces Firefox headless mode
- `CHROMIUM_NO_SANDBOX=1` forces Chromium `--no-sandbox`
- `E2E_VERBOSE_DRIVER_LOGS=1` enables verbose WebDriver logs
- `E2E_VERBOSE_CHROMIUM_LOGS=1` enables extra Chromium launcher logs

Advanced override:

- `CHROMIUM_ALLOW_GOOGLE_CHROME=1`

Use that only if you know exactly why you need it. The default guard exists because branded Google Chrome is not a reliable target for unpacked extension Selenium runs.

## What the `archive` e2e test checks

The current automated test opens `https://map.earthmc.net/`, switches the extension into archive mode, refreshes the page, and checks that:

- the archive label appears
- the archive label stays stable
- archive marker counts differ from live marker counts
- archive marker counts stay stable over repeated reads
- the UI does not create duplicate labels
- the UI does not create duplicate sidebars

## Troubleshooting

### The Chromium test says the extension did not load

Most likely cause:

- the launcher found branded Google Chrome instead of Chromium or Chrome for Testing

Fix:

- install Chromium, or
- place Chrome for Testing and ChromeDriver under `.tools/`, or
- point `CHROMIUM_BINARY_PATH` and `CHROMEDRIVER_PATH` at a compatible browser and matching driver

### The Chromium test opens a window and then hangs

This was previously caused by a Windows browser version probe that launched Chrome directly before Selenium started.

That startup path has been removed. If you still see a hang:

- rerun with `E2E_VERBOSE_CHROMIUM_LOGS=1`
- confirm which browser binary is being selected
- confirm you are not accidentally forcing branded Google Chrome

### I see a Windows sandbox access error with Chrome for Testing

On this Windows setup, the launcher automatically applies `--no-sandbox` for extension-based runs that use the local Chrome for Testing fallback.

If you still hit permission issues:

- make sure the repository is in a normal writable folder
- make sure antivirus or Windows security tools are not locking `chrome.exe`
- remove stale browser processes and rerun

### Firefox tests do not start

Make sure Firefox and `geckodriver` are installed and reachable.

If they are in custom locations, set:

- `FIREFOX_BINARY_PATH`
- `GECKODRIVER_PATH`

## Repository layout

Important folders and files:

- `src/`: shared extension source code
- `resources/`: static assets and page-context helpers
- `scripts/e2e/`: Selenium test runner, browser launchers, and tests
- `build-extension.js`: builds Chromium and Firefox extension packages
- `build-userscript.js`: builds the userscript output
- `manifest.json`: shared extension manifest source

## Upstream sync notes

This fork tries to keep browser-specific behavior isolated so upstream merges stay manageable.

The most likely merge-conflict files are:

- `manifest.json`
- `build-extension.js`
- `build-userscript.js`
- `README.md`
- browser compatibility helpers

Recommended sync flow:

```bash
git fetch upstream
git merge upstream/main
npm run build
npm run test:e2e
```

## Userscript fallback

The userscript build output is written to:

- `dist/emc-dynmapplus.user.js`

That build uses this fork's repository metadata rather than the upstream fork metadata.

## Attribution

This repository is based on the EarthMC Dynmap extension and its forks:

- Original project by 3meraldK:  
  https://github.com/3meraldK/earthmc-dynmap

- Fork by Owen3H:  
  https://github.com/Owen3H/earthmc-dynmap

This fork (earthmc-dynmap-cross-browser) extends the project with:

- Cross-browser support (Chromium + Firefox)
- Bug fixes and performance improvements
- Automated testing and improved reliability
