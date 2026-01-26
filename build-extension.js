import fs from 'fs'
import path from 'path'
import archiver from 'archiver'

const ZIP_NAME = 'earthmc-dynmap.zip'

const output = fs.createWriteStream(path.join('dist', ZIP_NAME))
const archive = archiver('zip', { zlib: { level: 9 } })
archive.pipe(output)

archive.directory('src', 'src')
archive.file('manifest.json', { name: 'manifest.json' })
archive.file('icon48.png', { name: 'icon48.png' })
archive.file('icon128.png', { name: 'icon128.png' })
archive.file('README.md', { name: 'README.md' })
archive.file('style.css', { name: 'style.css' })

archive.finalize().then(() => console.log('Successfully compiled extension zip. Output at: dist/earthmc-dynmap.zip'))