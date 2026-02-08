import { statSync, readdirSync, createWriteStream } from 'fs'
import * as path from 'path'
import * as archiver from 'archiver'

/**
 * Adds a directory to the archive, recursively, skipping ignored files.
 * @param archive Archiver instance
 * @param srcDir Source directory
 * @param destDir Destination path in the zip
 * @param ignore List of filenames to skip (relative to srcDir)
 */
function addDirIgnore(archive: archiver.Archiver, srcDir: string, destDir: string, ignore: string[] = []) {
	const dirContents = readdirSync(srcDir)
    for (const file of dirContents) {
		const fullPath = path.join(srcDir, file)
		const destPath = path.join(destDir, file)
		
        const stat = statSync(fullPath)
		if (stat.isDirectory()) {
			addDirIgnore(archive, fullPath, destPath, ignore)
		} else if (!ignore.includes(file)) {
			archive.file(fullPath, { name: destPath })
		}
	}
}

const EXT_NAME = 'emc-dynmapplus'
const outfile = path.join('dist', EXT_NAME+".zip")

const output = createWriteStream(outfile)
const archive = archiver.create('zip', { zlib: { level: 9 } })
archive.pipe(output)

addDirIgnore(archive, 'src', EXT_NAME+'/src', ['types.d.ts']) // Types are just for developing
archive.directory('resources', EXT_NAME+'/resources')
archive.file('manifest.json', { name: EXT_NAME+'/manifest.json' })
archive.file('README.md', { name: EXT_NAME+'/README.md' })

archive.finalize().then(() => console.log(`Successfully compiled extension. Output at: ${outfile}`))