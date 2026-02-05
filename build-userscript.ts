import { readFileSync, writeFileSync } from 'fs'
import { build, type BuildOptions } from 'esbuild'

const STYLE_CSS = readFileSync('style.css', 'utf8')
const BORDERS_JSON = JSON.parse(readFileSync('src/borders.json', 'utf8'))
const MANIFEST = JSON.parse(readFileSync('manifest.json', 'utf8'))

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

const buildOpts: BuildOptions = {
    entryPoints: ['src/interceptor.js', ...contentScripts.js],
    outdir: 'dist',
    bundle: true,
    write: false,
    format: 'cjs',
    target: ['es2020'],
    treeShaking: false,
    define: {
      IS_USERSCRIPT: 'true',
      STYLE_CSS: JSON.stringify(STYLE_CSS),
      BORDERS_JSON: JSON.stringify(BORDERS_JSON),
      MANIFEST: JSON.stringify(MANIFEST),
      window: 'unsafeWindow',
      'chrome.runtime.getURL': 'GM_getResourceURL',
    },
}

const outfile = 'dist/emcdynmapplus.user.js'
build(buildOpts).then(res => {
    const contentCode = res.outputFiles.map(f => f.text).join('\n')

    writeFileSync(outfile, `${HEADER}\n${contentCode}`)
    console.log(`Successfully compiled userscript. Output at: ${outfile}`)
})