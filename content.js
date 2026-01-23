(async function() {
	const manifest = chrome.runtime.getManifest()

	// Even though the scripts have already loaded, we still need to
	// inject their contents into the page so can access them and use them.
	//
	// manifest.json must specify resources in least-dependent order first.
	const files = manifest.web_accessible_resources[0].resources
	for (const file of files) {
		await injectScript(file)
	}

	// Signal to the page context (non-content scripts) that init is done.
	const vars = { MANIFEST_VERSION: manifest.version }
	document.dispatchEvent(new CustomEvent('EMCDYNMAPPLUS_READY', { detail: vars }))
})()

/** 
 * Injects a file into the page context given the path to it. 
 * This is similar to adding \<script src="main.js"></script> to an HTML file.
 * @param {string} path
 * @returns {Promise<void>}
 */
// TODO: This is an unsafe workaround and we should migrate to ES6 modules with dynamic import.
function injectScript(path) {
	return new Promise(resolve => {
		const script = document.createElement('script')
		script.src = chrome.runtime.getURL(path)
		script.onload = () => { script.remove(); resolve() }
		(document.head || document.documentElement).appendChild(script)
	})
}