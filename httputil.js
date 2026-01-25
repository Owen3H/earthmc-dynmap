// save the normal fetch before main.js overrides it
const { fetch: originalFetch } = window

const EMC_DOMAIN = "earthmc.net"
const CURRENT_MAP = "aurora"

const OAPI_BASE = `https://api.${EMC_DOMAIN}/v3` // bump number here after migrating to a new OAPI ver
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
let markersModified = false
window.fetch = async (...args) => {
	const response = await originalFetch(...args)
	if (!response.ok && response.status != 304) return null
	if (response.url.includes('web.archive.org')) return response

	const isMarkers = response.url.includes('markers.json')
	const isSettings = response.url.includes('minecraft_overworld/settings.json')
	if (!isMarkers && !isSettings) return response // Continue as normal. We only care about modifying markers and settings.
	if (isMarkers && markersModified) return null // prevent modifying markers more than once

	let data = await response.clone().json().catch(console.error)
	if (!data) return null // prevent modifying response if we had bad data to begin with

	if (isMarkers) {
		data = await main(data)
		markersModified = true
	} else {
		data = modifySettings(data)
	}
	
	console.log(`intercepted: ${response.url}\n\tinjected custom html into response body`)
	return new Response(JSON.stringify(data))
}