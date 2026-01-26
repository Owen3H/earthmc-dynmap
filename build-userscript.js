import fs from 'fs'
import esbuild from 'esbuild'

// read manifest
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'))

const STYLE_CSS = fs.readFileSync('style.css', 'utf8').toString()
const HEADER = `// ==UserScript==
// @name        ${manifest.name}
// @version     ${manifest.version}
// @description ${manifest.description}
// @author      ${manifest.author}
// @include     https://map.earthmc.net/*
// @iconURL     https://raw.githubusercontent.com/Owen3H/earthmc-dynmap/main/icon128.png
// @grant       GM_addStyle
// @grant       GM_getResourceURL
// @resource    src-interceptor https://raw.githubusercontent.com/Owen3H/earthmc-dynmap/main/src/interceptor.js
// ==/UserScript==
`

const contentFiles = manifest['content_scripts'][0].js
const buildOpts = {
    entryPoints: contentFiles,
    outdir: 'dist',
    bundle: true,
    write: false,
    format: 'cjs',
    target: ['es2020'],
    treeShaking: false,
    define: {
      IS_USERSCRIPT: 'true',
      STYLE_CSS: JSON.stringify(STYLE_CSS),
      MANIFEST: JSON.stringify(manifest),
      window: 'unsafeWindow',
      'chrome.runtime.getURL': 'GM_getResourceURL',
    },
    loader: {
      '.css': 'text'
    }
}

esbuild.build(buildOpts).then(res => {
    const contentCode = res.outputFiles.map(f => f.text).join('\n')

    fs.writeFileSync('dist/emcdynmapplus.user.js', `${HEADER}\n${contentCode}`)
    console.log('Successfully compiled userscript. Output at: dist/emcdynmapplus.user.js')
})