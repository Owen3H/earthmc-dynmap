(async function entrypoint() {
	const isUserscript = typeof IS_USERSCRIPT !== 'undefined' && IS_USERSCRIPT
	const manifest = isUserscript ? MANIFEST : chrome.runtime.getManifest()
	if (!isUserscript) {
		// Any scripts that need to be injected into the page context should be specified in manifest.json 
		// under web_accessible_resources in order of least-dependent first.
		const resources = manifest.web_accessible_resources[0].resources
		const jsFiles = resources.filter(s => s.endsWith('.js'))
		for (const file of jsFiles) {
			await injectScript(file)
		}
	}

	document.addEventListener('EMCDYNMAPPLUS_INTERCEPT', async e => {
		const { url, data } = e.detail
		try {
			//console.log('intercepted: ' + url + "\n\tmodifying markers..")

			const modifiedData = await main(data)
			document.dispatchEvent(new CustomEvent('EMCDYNMAPPLUS_MODIFIED', {
				detail: { url, data: modifiedData, wasModified: true }
			}))
		} catch (err) {
			console.error(`Error modifying data of at ${url}:\n${err.toString()}`)
			document.dispatchEvent(new CustomEvent('EMCDYNMAPPLUS_MODIFIED', {
				detail: { url, data, wasModified: false }
			}))
		}
	})

	// If not 'complete' or 'interactive', defer init until DOM is ready.
    if (document.readyState !== 'loading') init(manifest)
    else document.addEventListener('DOMContentLoaded', _ => init(manifest))
})()

/** 
 * Injects a file into the page context given the path to it. 
 * This is similar to adding \<script src="main.js"></script> to an HTML file.
 * @param {string} resource - The path/filename to/of the file to inject.
 * @param {string} local - Whether the file should be injected locally (text) or external (src).
 * @returns {Promise<void>}
 */
// TODO: This is an unsafe workaround and we should migrate to ES6 modules with dynamic import.
function injectScript(resource) {
	return new Promise(resolve => {
		const script = document.createElement('script')
		script.src = chrome.runtime.getURL(resource) // replaced at build time for userscript
		script.onload = () => { script.remove(); resolve() }
		(document.head || document.documentElement).appendChild(script)
	})
}

function init(manifest) {
	const isUserscript = typeof IS_USERSCRIPT !== 'undefined' && IS_USERSCRIPT
	if (isUserscript) {
		GM_addStyle(STYLE_CSS)
	}

    console.log("emcdynmapplus: Initializing UI elements..")

    localStorage['emcdynmapplus-mapmode'] ??= 'meganations'
    localStorage['emcdynmapplus-darkened'] ??= 'true'
	localStorage['emcdynmapplus-serverinfo'] ??= 'true'
    
    insertSidebarMenu()
	insertServerInfoPanel().then(el => updateServerInfo(el))
    editUILayout()
    initToggleOptions() // brightness and dark mode

	checkForUpdate(manifest)
}

/** @returns {string} */
function checkForUpdate(manifest) {
    const cachedVer = localStorage['emcdynmapplus-version']
    const latestVer = manifest.version
    console.log("emcdynmapplus: current version is: " + latestVer)

    if (!cachedVer) return localStorage['emcdynmapplus-version'] = latestVer
    if (cachedVer != latestVer) {
        const changelogURL = `${PROJECT_URL}/releases/v${latestVer}`
        showAlert(`
            Extension has been automatically updated from ${cachedVer} to ${latestVer}. 
            Read what has been changed <a href="${changelogURL}" target="_blank">here</a>.
        `)
    }

    return localStorage['emcdynmapplus-version'] = latestVer
}

const SERVERINFO_INTERVAL = 5_000
let serverInfoScheduler = null

/**
 * @param {HTMLElement} element - The "#server-info" element.
 */
async function updateServerInfo(element) {
	const info = await fetchServerInfo()
	if (info) renderServerInfo(element, info)

	// schedule next only if still enabled
	if (localStorage['emcdynmapplus-serverinfo'] === 'true') {
		serverInfoScheduler = setTimeout(() => updateServerInfo(element), SERVERINFO_INTERVAL)
	} else {
		serverInfoScheduler = null
	}
}