import { readFileSync, writeFileSync } from 'fs'
import { build } from 'esbuild'
import * as path from 'path'

const FORK_REPO = 'JasonSolace/earthmc-dynmap-cross-browser'
const STYLE_CSS = readFileSync('resources/style.css', 'utf8')
const BORDERS = JSON.parse(readFileSync('resources/borders.json', 'utf8'))
const MANIFEST = JSON.parse(readFileSync('manifest.json', 'utf8'))

// TODO: Dynamically insert @include tags depending on matches arr count
const contentScripts = MANIFEST.content_scripts[0]
const HEADER = `// ==UserScript==
// @name        ${MANIFEST.name}
// @version     ${MANIFEST.version}
// @description ${MANIFEST.description}
// @author      ${MANIFEST.author}
// @include     ${contentScripts.matches[0]}
// @include     ${contentScripts.matches[1]}
// @icon        https://raw.githubusercontent.com/${FORK_REPO}/main/resources/icon48.png
// @downloadURL https://raw.githubusercontent.com/${FORK_REPO}/main/dist/emc-dynmapplus.user.js
// @grant       GM_addStyle
// ==/UserScript==
`

const outdir = 'dist'
const outfile = path.join(outdir, 'emc-dynmapplus.user.js')
const webAccessibleScripts = (MANIFEST.web_accessible_resources?.[0]?.resources || []).filter(file => file.endsWith('.js'))

const buildOpts = {
	entryPoints: [...webAccessibleScripts, ...contentScripts.js],
	outdir,
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
	},
}

const start = performance.now()
build(buildOpts).then(res => {
	const contentCode = res.outputFiles.map(f => f.text).join('\n')
	writeFileSync(outfile, `${HEADER}\n${contentCode}`)

	const elapsed = (performance.now() - start).toFixed(2)
	const relPath = '.' + path.sep + path.relative(process.cwd(), outfile)

	console.log(`Successfully generated userscript.\n  Output: ${relPath}\n  Took: ${elapsed}ms\n`)
}).catch(error => {
	console.error(error?.stack || error?.message || String(error))
	process.exitCode = 1
})
