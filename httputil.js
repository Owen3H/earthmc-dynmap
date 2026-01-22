// save the normal fetch (just once) before we later override it
if (!window.originalFetch) {
    window.originalFetch = window.fetch
}

window.EMC_DOMAIN = "earthmc.net"
window.CURRENT_MAP = "aurora"

window.OAPI_BASE = `https://api.${EMC_DOMAIN}/v3` // bump version here after updating code to new api ver
window.MAPI_BASE = `https://map.${EMC_DOMAIN}`
window.CAPI_BASE = `https://emcstats.bot.nu`

window.PROXY_URL = `https://api.codetabs.com/v1/proxy/?quest=`
window.PROJECT_URL = "https://github.com/3meraldK/earthmc-dynmap"

/**
 * Fetches data at url, parsing it as JSON unless we received 404.
 * @param {string} url 
 * @param {RequestInit} options 
 */
window.fetchJSON = async function fetchJSON(url, options = null) {
    const response = await originalFetch(url, options)
    if (response.status == 404) return null
    if (response.ok) return response.json()

    return null
}

// Replace the default fetch() with ours to intercept responses
let preventMapUpdate = false
window.fetch = async (...args) => {
	let [resource, config] = args
	let response = await originalFetch(resource, config)

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

	const modified =
		isMarkers ? main(data) : 
		isSettings ? modifySettings(data) : data;

	return new Response(JSON.stringify(modified))
}