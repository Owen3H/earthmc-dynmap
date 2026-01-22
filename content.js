(async function injectScripts() {
	// Attach to global window since we cannot get runtime from web_accessible_resources
	window.CURRENT_VERSION = chrome.runtime.getManifest().version

	// Even though the scripts have already loaded, we still need to
	// inject their contents into the page so can access them and use them.
	//
	// Injection order matters: least-dependent first, same as in manifest.json.
	await injectScript('httputil.js')
	await injectScript('dom.js')
	await injectScript('main.js')

	// This has to be last to ensure all funcs/objs from previous injections are defined. 
	// For example, waitForElement from ui.js can be referred to after bootstrap finishes.
	// 
	// This is also where init is called from after the DOM becomes ready.
    await injectScript('bootstrap.js')
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