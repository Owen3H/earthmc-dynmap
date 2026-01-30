import fs from 'fs'
import esbuild from 'esbuild'

const STYLE_CSS = fs.readFileSync('style.css', 'utf8').toString()
const BORDERS_JSON = JSON.parse(fs.readFileSync('src/borders.json', 'utf8'))
const MANIFEST = JSON.parse(fs.readFileSync('manifest.json', 'utf8'))

const HEADER = `// ==UserScript==
// @name        ${MANIFEST.name}
// @version     ${MANIFEST.version}
// @description ${MANIFEST.description}
// @author      ${MANIFEST.author}
// @include     ${MANIFEST.content_scripts[0].matches[0]}
// @iconURL     https://raw.githubusercontent.com/3meraldK/earthmc-dynmap/main/icon.png
// @grant       GM_addStyle
// ==/UserScript==
`

const contentFiles = MANIFEST.content_scripts[0].js
const buildOpts = {
    entryPoints: ['src/interceptor.js', ...contentFiles],
    outdir: 'dist',
    bundle: true,
    write: false,
    format: 'cjs',
    target: ['es2020'],
    treeShaking: false,
    //loader: { '.css': 'text' }
    define: {
      IS_USERSCRIPT: 'true',
      STYLE_CSS: JSON.stringify(STYLE_CSS),
      BORDERS_JSON: JSON.stringify(BORDERS_JSON),
      MANIFEST: JSON.stringify(MANIFEST),
      window: 'unsafeWindow',
      'chrome.runtime.getURL': 'GM_getResourceURL',
    },
}

esbuild.build(buildOpts).then(res => {
    const contentCode = res.outputFiles.map(f => f.text).join('\n')

    fs.writeFileSync('dist/emcdynmapplus.user.js', `${HEADER}\n${contentCode}`)
    console.log('Successfully compiled userscript. Output at: dist/emcdynmapplus.user.js')
})