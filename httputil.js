// save the normal fetch before main.js overrides it
const { fetch: originalFetch } = window

const EMC_DOMAIN = "earthmc.net"
const CURRENT_MAP = "aurora"

const OAPI_BASE = `https://api.${EMC_DOMAIN}/v3` // bump version here after updating code to new api ver
const MAPI_BASE = `https://map.${EMC_DOMAIN}`
const CAPI_BASE = `https://emcstats.bot.nu`

const PROXY_URL = `https://api.codetabs.com/v1/proxy/?quest=`
const PROJECT_URL = "https://github.com/3meraldK/earthmc-dynmap"

/**
 * Fetches data at url, parsing it as JSON unless we received 404.
 * @param {string} url 
 * @param {RequestInit} options 
 */
async function fetchJSON(url, options = null) {
    const response = await originalFetch(url, options)
    if (!response.ok && response.status != 304) return null

    return response.json()
}

// Replace the default fetch() with ours to intercept responses
let preventMapUpdate = false
window.fetch = async (...args) => {
	const [url, opts] = args
	const response = await originalFetch(url, opts)

	if (response.url.includes('web.archive.org')) return response

	const isMarkers = response.url.includes('markers.json')
	const isSettings = response.url.includes('minecraft_overworld/settings.json')
	if (!isMarkers && !isSettings) return response

	// Modify contents of markers.json and settings.json
	if (isMarkers) {
		if (preventMapUpdate) return null
		preventMapUpdate = true
	}

	const data = await response.clone().json()
	if (data.length < 1) return null // prevent a map update from bad data

	let modified = isSettings ? modifySettings(data) : data;
    if (isMarkers) {
        console.log(`intercepted: ${response.url}\n\tinjecting custom html into markers body`)
        modified = await main(data)
    }

	return new Response(JSON.stringify(modified))
}