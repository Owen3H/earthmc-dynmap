const { fetch: originalFetch } = window

// Replace the default fetch() with ours to intercept responses
let markersIntercepted = false
window.fetch = async (...args) => {
	const response = await originalFetch(...args)
	if (!response.ok && response.status != 304) return response
	if (response.url.includes('web.archive.org')) return response

	const isMarkers = response.url.includes('markers.json')
	const isSettings = response.url.includes('minecraft_overworld/settings.json')
    if (!isMarkers && !isSettings) return response // Continue as normal. We only care about modifying markers and settings.
    if (isMarkers) {
        if (markersIntercepted) return null
        markersIntercepted = true
    }

	const data = await response.clone().json().catch(e => { console.error(e); return null })
	if (!data) return response // prevent modifying response if we had bad data to begin with

    if (isSettings) {
        console.log(`intercepted: ${response.url}\n\tmodifying body to include player heads`)
        return new Response(JSON.stringify(modifySettings(data)))
    }

    const eventDetail = { url: response.url, data, wasModified: false }
    document.dispatchEvent(new CustomEvent('EMCDYNMAPPLUS_INTERCEPT', { detail: eventDetail }))

    // Wait for content script to modify the data
    await new Promise(resolve => {
        document.addEventListener('EMCDYNMAPPLUS_MODIFIED', e => {
            if (e.detail.url === response.url) {
                Object.assign(eventDetail, e.detail)
                resolve()
            }
        }, { once: true })
    })

    // An error likely occurred during modification
    if (!eventDetail.wasModified) return null
	
	console.log(`intercepted: ${response.url}\n\tinjected custom html into response body`)
    return new Response(JSON.stringify(eventDetail.data), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
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

document.addEventListener('EMCDYNMAPPLUS_ADJUST_SCROLL', e => {
	const adjustedZoom = e.detail.pxPerZoomLevel  // Get the adjusted zoom value from the custom event
    console.log('attempting to adjust zoom to: ' + adjustedZoom)

	// Apply the zoom sensitivity adjustment via Leaflet
	if (window.L && window.L.Map) {
		window.L.Map.mergeOptions({ wheelPxPerZoomLevel: adjustedZoom })
	}
})