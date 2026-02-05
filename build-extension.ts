import { createWriteStream } from 'fs'
import * as path from 'path'
import * as archiver from 'archiver'

const EXT_NAME = 'earthmc-dynmap'

const outfile = path.join('dist', EXT_NAME+".zip")
const output = createWriteStream(outfile)
const archive = archiver.create('zip', { zlib: { level: 9 } })
archive.pipe(output)

archive.directory('src', EXT_NAME+'/src')
archive.file('manifest.json', { name: EXT_NAME+'/manifest.json' })
archive.file('icon48.png', { name: EXT_NAME+'/icon48.png' })
archive.file('icon128.png', { name: EXT_NAME+'/icon128.png' })
archive.file('README.md', { name: EXT_NAME+'/README.md' })
archive.file('style.css', { name: EXT_NAME+'/style.css' })

archive.finalize().then(() => console.log(`Successfully compiled extension. Output at: ${outfile}`))