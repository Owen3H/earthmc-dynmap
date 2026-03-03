/** @returns {boolean} */
function isUserscript() {
	return typeof IS_USERSCRIPT !== 'undefined' && IS_USERSCRIPT
}

/** THIS FILE IS RUN FIRST, ANY SETUP/INIT REQUIRED BELONGS HERE */
(async function entrypoint() {
	const manifest = isUserscript() ? MANIFEST : chrome.runtime.getManifest()
	if (!isUserscript()) {
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

			const modifiedData = await modifyMarkers(data)
			document.dispatchEvent(new CustomEvent('EMCDYNMAPPLUS_MODIFIED', {
				detail: { url, data: modifiedData, wasModified: true }
			}))
		} catch (err) {
			console.error(`Error modifying data of: ${url}\n`, err)
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
function injectScript(resource) {
	return new Promise(resolve => {
		const script = document.createElement('script')
		script.src = chrome.runtime.getURL(resource) // replaced at build time for userscript
		script.onload = () => { script.remove(); resolve() }
		(document.head || document.documentElement).appendChild(script)
	})
}

/** @param {Manifest} manifest */
async function init(manifest) {
	const isUserscript = typeof IS_USERSCRIPT !== 'undefined' && IS_USERSCRIPT
	if (isUserscript) {
		GM_addStyle(STYLE_CSS)
	}

    localStorage['emcdynmapplus-mapmode'] ??= 'meganations'
	localStorage['emcdynmapplus-normalize-scroll'] ??= 'true'
    localStorage['emcdynmapplus-darkened'] ??= 'true'
	localStorage['emcdynmapplus-serverinfo'] ??= 'true'
	localStorage['emcdynmapplus-capital-stars'] ??= 'true'

	localStorage['emcdynmapplus-nation-claims-opaque-colors'] ??= 'true'
	localStorage['emcdynmapplus-nation-claims-show-excluded'] ??= 'true'

	console.log("emcdynmapplus: Initializing UI elements..")

	loadCustomFonts()
    
	await insertSidebarMenu()
	updateServerInfo(await insertServerInfoPanel())
    await editUILayout()
	await insertScreenshotBtn()
	
	// inserts the claim color customizer if 'nationclaims' mode is active
	const panel = await tryInsertNationClaimsPanel()
	if (panel) loadNationClaims(panel)
		
	initToggleOptions()
	checkForUpdate(manifest)
}

const baseZoom = 90
const scrollLineDelta = 30	// 1 scroll line = ~30 deltaY in windows
const scrollThreshold = 5	// increase zoom by this many scroll lines

/** @param {number} deltaY */
function triggerScrollEvent(deltaY) {
    // Calculate how many sets of 5 scroll lines the user scrolled
    const zoomMultiplier = Math.floor(Math.abs(deltaY) / (scrollLineDelta * scrollThreshold))
    const pxPerZoomLevel = baseZoom + (zoomMultiplier * 30)

	const eventData = { detail: { pxPerZoomLevel: deltaY < 0 ? pxPerZoomLevel : -pxPerZoomLevel } }
    document.dispatchEvent(new CustomEvent('EMCDYNMAPPLUS_ADJUST_SCROLL', eventData))
}

const SERVERINFO_INTERVAL = 5_000
let serverInfoScheduler = null

/** @param {HTMLElement} element - The "#server-info" element. */
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

/** @param {Manifest} manifest */
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