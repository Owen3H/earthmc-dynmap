const { fetch: originalFetch } = window

// Replace the default fetch() with ours to intercept responses
let markersResponsePromise = null
window.fetch = async (...args) => {
	const response = await originalFetch(...args)

	if (!response.ok && response.status !== 304) return response
	if (!response.url.includes('markers.json')) return response

	// If a modification is already in progress or done, reuse it
	if (markersResponsePromise) return markersResponsePromise.then(r => r.clone())

	markersResponsePromise = (async () => {
		const data = await response.clone().json()
        if (!data) return response

		const eventDetail = { url: response.url, data, wasModified: false }
		document.dispatchEvent(new CustomEvent('EMCDYNMAPPLUS_INTERCEPT', { detail: eventDetail }))

		await new Promise(resolve => {
			document.addEventListener('EMCDYNMAPPLUS_MODIFIED', e => {
				if (e.detail.url === response.url) {
					Object.assign(eventDetail, e.detail)
					resolve()
				}
			}, { once: true })
		})

		if (!eventDetail.wasModified) return response
		
		return new Response(JSON.stringify(eventDetail.data), {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers,
		})
	})()

	return markersResponsePromise.then(r => r.clone())
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