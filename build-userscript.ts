import { readFileSync, writeFileSync } from 'fs'
import { build, type BuildOptions } from 'esbuild'
import * as path from 'path'
import './src/types' // they are global anyway but vscode shits itself sometimes

const STYLE_CSS = readFileSync('resources/style.css', 'utf8')
const BORDERS: Borders = JSON.parse(readFileSync('resources/borders.json', 'utf8'))
const MANIFEST: Manifest = JSON.parse(readFileSync('manifest.json', 'utf8'))

const contentScripts = MANIFEST.content_scripts[0]
const HEADER = `// ==UserScript==
// @name        ${MANIFEST.name}
// @version     ${MANIFEST.version}
// @description ${MANIFEST.description}
// @author      ${MANIFEST.author}
// @include     ${contentScripts.matches[0]}
// @iconURL     https://raw.githubusercontent.com/3meraldK/earthmc-dynmap/main/icon.png
// @grant       GM_addStyle
// ==/UserScript==
`

const outdir = 'dist'
const outfile = path.join(outdir, 'emc-dynmapplus.user.js')

const buildOpts: BuildOptions = {
    entryPoints: ['resources/interceptor.js', ...contentScripts.js],
    outdir: outdir,
    bundle: true,
    write: false,
    format: 'cjs',
    target: ['es2020'],
    treeShaking: false,
    define: {
        IS_USERSCRIPT: 'true',
        STYLE_CSS: JSON.stringify(STYLE_CSS),
        BORDERS: JSON.stringify(BORDERS),
        MANIFEST: JSON.stringify(MANIFEST),
        window: 'unsafeWindow',
        'chrome.runtime.getURL': 'GM_getResourceURL',
    },
}

build(buildOpts).then(res => {
    const contentCode = res.outputFiles.map(f => f.text).join('\n')

    writeFileSync(outfile, `${HEADER}\n${contentCode}`)
    console.log(`Successfully compiled userscript. Output at: ${outfile}`)
})