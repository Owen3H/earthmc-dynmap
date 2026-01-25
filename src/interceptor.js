const { fetch: originalFetch } = window

// Replace the default fetch() with ours to intercept responses
let markersModified = false
window.fetch = async (...args) => {
	const response = await originalFetch(...args)
	if (!response.ok && response.status != 304) return response
	if (response.url.includes('web.archive.org')) return response

	const isMarkers = response.url.includes('markers.json')
	const isSettings = response.url.includes('minecraft_overworld/settings.json')
    if (!isMarkers && !isSettings) return response // Continue as normal. We only care about modifying markers and settings.
	if (isMarkers && markersModified) return null // null prevents modified markers being overwritten

	const data = await response.clone().json().catch(console.error)
	if (!data) return null // prevent modifying response if we had bad data to begin with

    if (isSettings) {
        return new Response(JSON.stringify(modifySettings(data)))
    }

    const eventDetail = { url: response.url, data, isMarkers, wasModified: false }
    document.dispatchEvent(new CustomEvent('EMCDYNMAPPLUS_INTERCEPT', { detail: eventDetail }))

    // Wait for content script to modify the data
    await new Promise(resolve => {
        document.addEventListener('EMCDYNMAPPLUS_MODIFIED', e => {
            if (e.detail.url === response.url) {
                Object.assign(eventDetail, e.detail)
                if (isMarkers && e.detail.wasModified) {
                    markersModified = true
                }

                resolve()
            }
        })
    })
    
    // fallback if modification failed
    if (!eventDetail.wasModified) return null
	
	console.log(`intercepted: ${response.url}\n\tinjected custom html into response body`)
    return new Response(JSON.stringify(eventDetail.data), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
    })
}

/** @param {Object} data - The settings response JSON data. */
function modifySettings(data) {
	// Set camera on Europe and zoom all the way out
    data.spawn = { x: 3400, z: -8800 }
	data.zoom.def = 0

	data['player_tracker'].nameplates['heads_url'] = 'https://mc-heads.net/avatar/{uuid}/16'
	data['player_tracker'].nameplates['show_heads'] = true

    // I think these are all disabled server side but may as well ;)
    data['player_tracker'].update_interval = 1
	data['player_tracker'].nameplates['show_health'] = true
    data['player_tracker'].nameplates['show_armor'] = true
    data['player_tracker'].nameplates['show_effects'] = true

	return data
}

/**
 * @param {string} playerName
 * @param {boolean} showOnlineStatus
 */
async function lookupPlayer(playerName, showOnlineStatus = true) {
    const detail = { player: playerName, showOnlineStatus }
	document.dispatchEvent(new CustomEvent('EMCDYNMAPPLUS_PLAYER_LOOKUP', { detail }))
}