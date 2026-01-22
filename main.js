const { 
	fetch: originalFetch,
	fetchJSON, PROXY_URL,
	CAPI_BASE, OAPI_BASE,
	CURRENT_MAP,
} = window

const htmlCode = {
	playerLookup: '<div class="leaflet-control-layers leaflet-control left-container" id="player-lookup"></div>',
	partOfLabel: '<span id="part-of-label">Part of <b>{allianceList}</b></span>',
	residentClickable: '<span class="resident-clickable" onclick="lookupPlayer(\'{player}\')">{player}</span>',
	residentList: '<span class="resident-list">\t{list}</span>',
	scrollableResidentList: '<div class="resident-list" id="scrollable-list">\t{list}</div>',
	playerLookupLoading: '<div class="leaflet-control-layers leaflet-control left-container" id="player-lookup-loading">Loading...</button>',
	alertBox: '<div id="alert"><p id="alert-message">{message}</p><br><button id="alert-close">OK</button></div>',
	alertMsg: '<div class="message" id="alert"><p id="alert-message">{message}</p></div>'
}

const archiveDate = () => parseInt(localStorage['emcdynmapplus-archive-date'])

let alliances = null
const currentMapMode = () => localStorage['emcdynmapplus-mapmode'] ?? 'meganations'
if (currentMapMode() != 'default' && currentMapMode() != 'archive') {
	getAlliances().then(result => alliances = result)
}

// Add clickable player nameplates
waitForHTMLelement('.leaflet-nameplate-pane').then(element => {
	element.addEventListener('click', event => {
		const username = event.target.textContent || event.target.parentElement.parentElement.textContent
		if (username.length > 0) lookupPlayer(username, false)
	})
})

/**
 * Shows an alert message in a box at the center of the screen.
 * @param {string} message 
 */
function showAlert(message) {
	if (document.querySelector('#alert') != null) document.querySelector('#alert').remove()
	document.body.insertAdjacentHTML('beforeend', htmlCode.alertBox.replace('{message}', message))
	document.querySelector('#alert-close').addEventListener('click', event => { event.target.parentElement.remove() })
}

/**
 * @param {object} data - The settings response JSON data.
 */
function modifySettings(data) {
	data['player_tracker'].nameplates['show_heads'] = true
	data['player_tracker'].nameplates['heads_url'] = 'https://mc-heads.net/avatar/{uuid}/16'
	
	// Set camera on Europe
	data.spawn.x = 2000
	data.spawn.z = -10000
	
	data.zoom.def = 0
	return data
}

/** @param {string} str */
const isNumeric = (str) => Number.isFinite(+str)

/** @param {number} num */
const roundTo16 = (num) => Math.round(num / 16) * 16

// Fowler-Noll-Vo hash function
function hashCode(string) {
	let hexValue = 0x811c9dc5
	for (let i = 0; i < string.length; i++) {
		hexValue ^= string.charCodeAt(i)
		hexValue += (hexValue << 1) + (hexValue << 4) + (hexValue << 7) + (hexValue << 8) + (hexValue << 24)
	}
	return '#' + ((hexValue >>> 0) % 16777216).toString(16).padStart(6, '0')
}

/**
 * Shoelace formula
 * @param {{x: number, z: number}[]} vertices 
 */
function getArea(vertices) {
	const amtVerts = vertices.length
	let area, i = 0

	// Vertices need rounding to 16 because data has imprecise coordinates
	for (; i < amtVerts; i++) {
		const j = (i + 1) % amtVerts
		area += roundTo16(vertices[i].x) * roundTo16(vertices[j].z)
		area -= roundTo16(vertices[j].x) * roundTo16(vertices[i].z)
	}

	return (Math.abs(area) / 2) / (16 * 16)
}

// By James Halliday (substack)
function pointInPolygon(vertex, polygon) {
	let { x, z } = vertex
	let n = polygon.length
	let inside = false
	for (let i = 0, j = n - 1; i < n; j = i++) {
		let xi = polygon[i].x
		let zi = polygon[i].z
		let xj = polygon[j].x
		let zj = polygon[j].z

		let intersect = ((zi > z) != (zj > z))
			&& (x < (xj - xi) * (z - zi) / (zj - zi) + xi)
		if (intersect) inside = !inside
	}
	return inside
}

// Modify town descriptions for Dynmap archives
function modifyOldDescription(marker) {
	// Gather some information
	const residents = marker.popup.match(/Members <span style="font-weight:bold">(.*)<\/span><br \/>Flags/)?.[1]
	const residentNum = residents?.split(', ')?.length || 0
	const isCapital = marker.popup.match(/capital: true/) != null
	const area = getArea(marker.points)

	// Modify description
	if (isCapital) marker.popup = marker.popup.replace('120%">', '120%">★ ')
	if (archiveDate() < 20220906) {
		marker.popup = marker.popup.replace(/">hasUpkeep:.+?(?<=<br \/>)/, '; white-space:pre">')
	}
	else marker.popup = marker.popup.replace('">pvp:', '; white-space:pre">pvp:')

	marker.popup = marker.popup.replace('Flags<br />', '<br>Flags<br>')
		.replace('>pvp:', '>PVP allowed:')
		.replace('>mobs:', '>Mob spawning:')
		.replace('>public:', '>Public status:')
		.replace('>explosion:', '>Explosions:&#9;')
		.replace('>fire:', '>Fire spread:&#9;')
		.replace(/<br \/>capital:.*<\/span>/, '</span>')
		.replaceAll('true<', '&#9;<span style="color:green">Yes</span><')
		.replaceAll('false<', '&#9;<span style="color:red">No</span><')
		.replace(`Members <span`, `Members <b>[${residentNum}]</b> <span`)
	if (area > 0) {
		marker.popup = marker.popup
		.replace(`</span><br /> Members`, `</span><br>Size<span style="font-weight:bold"> ${area} </span><br> Members`)
	}
	// Scrollable resident list
	if (residentNum > 50) {
		marker.popup = marker.popup
			.replace(`<b>[${residentNum}]</b> <span style="font-weight:bold">`,
				`<b>[${residentNum}]</b> <div id="scrollable-list"><span style="font-weight:bold">`)
			.replace('<br>Flags', '</div><br>Flags')
	}

	return marker
}

function modifyDescription(marker) {
	// Gather some information
	const town = marker.tooltip.match(/<b>(.*)<\/b>/)[1]
	const isCapital = marker.tooltip.match(/\(Capital of (.*)\)/) != null
	const nation = marker.tooltip.match(/\(\b(?:Member|Capital)\b of (.*)\)\n/)?.[1]
	const mayor = marker.popup.match(/Mayor: <b>(.*)<\/b>/)?.[1]
	
	const residents = marker.popup.match(/<\/summary>\n    \t(.*)\n   \t<\/details>/)?.[1]
	const residentNum = residents.split(', ').length

	const councillors = marker.popup.match(/Councillors: <b>(.*)<\/b>/)?.[1]
		.split(', ').filter(councillor => councillor != 'None')

	// Fixes a bug with names that are wrapped in angle brackets
	const names = {
		town: town.replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
		nation: nation?.replaceAll('<', '&lt;').replaceAll('>', '&gt;') ?? nation
	}

	// Calculate town's area
	let area = 0
	if (marker.type == 'polygon') {
		const iteratedRegions = []
		for (const regionVertices of marker.points[0]) {

			// Exclude non-affiliated regions entirely inside town
			if (iteratedRegions.length > 0) {
				let isInsidePolygon = false
				for (const vertex of regionVertices) {
					for (const lastPolygon of iteratedRegions) {
						if (pointInPolygon(vertex, lastPolygon)) isInsidePolygon = true
					}
				}
				if (isInsidePolygon) area -= getArea(regionVertices)
				else area += getArea(regionVertices)
			}
			else area += getArea(regionVertices)
			iteratedRegions.push(regionVertices)

		}
	}

	// Create clickable resident lists
	const residentList = (currentMapMode() == 'archive') ? residents :
		residents.split(', ').map(resident => htmlCode.residentClickable.replaceAll('{player}', resident)).join(', ')
	const councillorList = (currentMapMode() == 'archive') ? councillors :
		councillors.map(councillor => htmlCode.residentClickable.replaceAll('{player}', councillor)).join(', ')

	// Modify description
	if (residentNum > 50) {
		marker.popup = marker.popup.replace(residents, htmlCode.scrollableResidentList.replace('{list}', residentList))
	} else {
		marker.popup = marker.popup.replace(residents + '\n', htmlCode.residentList.replace('{list}', residentList) + '\n')
	}

	marker.popup = marker.popup
		.replace('</details>\n   \t<br>', '</details>') // Remove line break
		.replace('Councillors:', `Size: <b>${area} chunks</b><br/>Councillors:`) // Add size info
		.replace('<i>/town set board [msg]</i>', '<i></i>') // Remove default town board
		.replace('<i></i> \n    <br>\n', '') // Remove empty town board
		.replace('\n    <i>', '\n    <i style="overflow-wrap: break-word">') // Wrap long town board
		.replace('Councillors: <b>None</b>\n\t<br>', '') // Remove none councillors info
		.replace('Size: <b>0 chunks</b><br/>', '') // Remove 0 chunks town size info
		.replace(town, names.town)
		.replace(nation, names.nation)
		.replaceAll('<b>false</b>', '<b><span style="color: red">No</span></b>') // 'False' flag
		.replaceAll('<b>true</b>', '<b><span style="color: green">Yes</span></b>') // 'True' flag
	if (currentMapMode() != 'archive') {
		marker.popup = marker.popup
		.replace(/Mayor: <b>(.*)<\/b>/, `Mayor: <b>${htmlCode.residentClickable.replaceAll('{player}', mayor)}</b>`) // Lookup mayor
		.replace(/Councillors: <b>(.*)<\/b>/, `Councillors: <b>${councillorList}</b>`) // Lookup councillors
	}
	if (isCapital) marker.popup = marker.popup
		.replace('<span style="font-size:120%;">', '<span style="font-size: 120%">★ ') // Add capital star

	// Modify tooltip
	marker.tooltip = marker.tooltip
		.replace('<i>/town set board [msg]</i>', '<i></i>')
		.replace('<br>\n    <i></i>', '')
		// Clamp long town board
		.replace('\n    <i>', '\n    <i id="clamped-board">')
		.replace(town, names.town)
		.replace(nation, names.nation)

	// Add 'Part of' label
	if (currentMapMode() == 'archive' || currentMapMode() == 'default') return marker
	const nationAlliances = getNationAlliances(nation)
	if (nationAlliances.length > 0) {
		const allianceList = nationAlliances.map(alliance => alliance.name).join(', ')
		const partOfLabel = htmlCode.partOfLabel.replace('{allianceList}', allianceList)
		marker.popup = marker.popup.replace('</span>\n', '</span></br>' + partOfLabel)
	}

	return marker
}

function convertOldMarkersStructure(markers) {
	return Object.entries(markers.areas).flatMap(([key, v]) => {
		if (key.includes('_Shop')) return []
		return {
			fillColor: value.fillcolor,
			color: value.color,
			popup: value.desc ?? `<div><b>${value.label}</b></div>`,
			weight: value.weight,
			opacity: value.opacity,
			type: 'polygon',
			points: v.x.map((x, i) => ({ x, z: v.z[i] }))
		}
	})
}

/**
 * @param {string} nation 
 * @returns 
 */
function getNationAlliances(nation) {
	const nationAlliances = []
	if (alliances == null) return nationAlliances
	for (const alliance of alliances) {
		if (!alliance.nations.includes(nation)) continue
		if (alliance.type != currentMapMode()) continue
		nationAlliances.push({name: alliance.name, colours: alliance.colours})
	}

	return nationAlliances
}

function colorTowns(marker) {
	const nation = marker.tooltip.match(/\(\b(?:Member|Capital)\b of (.*)\)\n/)?.[1]
	const mayor = marker.popup.match(/Mayor: <b>(.*)<\/b>/)?.[1]
	const isRuin = (mayor.match(/NPC[0-9]+/) != null)
	//const isNationless = (nation == null)
	
	// Universal properties for the map modes
	if (currentMapMode() == 'alliances') {
		marker.color = '#000000' // Black
		marker.fillColor = '#000000'
		marker.weight = 0.5
	} else {
		const nationHasDefaultColor = (marker.color == '#3fb4ff' && marker.fillColor == '#3fb4ff') // Default blue
		if (nationHasDefaultColor) {
			marker.color = '#363636' // Dark gray
			marker.fillColor = hashCode(nation)
		}
		else marker.color = '#89c500' // Default green
	}
	if (isRuin) return marker.fillColor = marker.color = '#000000' // Black

	// Properties for alliances
	const nationAlliances = getNationAlliances(nation)
	if (nationAlliances.length == 0) return marker
	marker.weight = 1.5
	marker.fillColor = nationAlliances[0].colours.fill
	marker.color = nationAlliances[0].colours.outline
	if (nationAlliances.length < 2) return marker
	marker.weight = 0.5

	return marker
}

function addChunksLayer(data) {
	const chunkLines = []
	for (let x = -33280; x <= 33088; x += 16) {
		chunkLines.push([
			{ 'x': x, 'z': -16640 },
			{ 'x': x, 'z': +16512 },
			{ 'x': x, 'z': -16640 }
		])
	}
	for (let z = -16640; z <= 16512; z += 16) {
		chunkLines.push([
			{ 'x': -33280, 'z': z },
			{ 'x': +33088, 'z': z },
			{ 'x': -33280, 'z': z }
		])
	}

	data[2] = {
		'hide': true,
		'name': 'Chunks',
		'control': true,
		'id': 'chunks',
		'markers': [{
			'weight': 0.33,
			'color': '#000000',
			'type': 'polyline',
			'points': chunkLines
		}]
	}
	return data
}

function waitForHTMLelement(selector) {
	return new Promise(resolve => {
		if (document.querySelector(selector)) {
			return resolve(document.querySelector(selector))
		}

		const observer = new MutationObserver(() => {
			if (document.querySelector(selector)) {
				resolve(document.querySelector(selector))
				observer.disconnect()
			}
		})
		observer.observe(document.body, { childList: true, subtree: true })
	})
}

function addElement(parent, element, returnWhat, all = false) {
	parent.insertAdjacentHTML('beforeend', element)
	return (!all) ? parent.querySelector(returnWhat) : parent.querySelectorAll(returnWhat)
}

/**
 * @param {Array<any>} data - The markers response JSON data.
 */
async function main(data) {
	if (currentMapMode() == 'archive') {
		data = await getArchive(data)
	}

	data = addChunksLayer(data)
	data = await addCountryLayer(data)

	if (!data?.[0]?.markers?.length) {
		showAlert('Unexpected error occurred while loading the map, maybe EarthMC is down? Try again later.')
		return data
	}

	for (let marker of data[0].markers) {
		if (marker.type != 'polygon' && marker.type != 'icon') continue

		marker = (currentMapMode() != 'archive' || archiveDate() >= 20240701)
		? modifyDescription(marker) : modifyOldDescription(marker)

		if (marker.type != 'polygon') continue

		// Universal properties
		marker.opacity = 1
		marker.fillOpacity = 0.33
		marker.weight = 1.5

		if (currentMapMode() == 'default' || currentMapMode() == 'archive') continue

		marker = colorTowns(marker)
	}
	
	return data
}

async function addCountryLayer(data) {
	if (!localStorage['emcdynmapplus-borders']) {
		const loadingMessage = addElement(document.body, htmlCode.alertMsg.replace('{message}', 'Downloading country borders...'), '.message')
		const markersURL = 'https://web.archive.org/web/2024id_/https://earthmc.net/map/aurora/standalone/MySQL_markers.php?marker=_markers_/marker_earth.json'
		const fetch = await fetchJSON(PROXY_URL + markersURL)
		loadingMessage.remove()
		if (!fetch) {
			showAlert('Could not download optional country borders layer, you could try again later.')
			return data
		}
		localStorage['emcdynmapplus-borders'] = JSON.stringify(fetch.sets['borders.Country Borders'].lines)
	}

	try {
		const points = []
		const countries = JSON.parse(localStorage['emcdynmapplus-borders'])
		for (const k of countries) {
			const line = countries[k]
			const linePoints = []
			for (let i = 0; i < x.length; i++) {
				if (!isNumeric(line.x[i])) continue
				linePoints.push({ x: line.x[i], z: line.z[i] })
			}
			points.push(linePoints)
		}

		data[3] = {
			'hide': true,
			'name': 'Country Borders',
			'control': true,
			'id': 'borders',
			'order': 999,
			'markers': [{
				'weight': 1,
				'color': '#ffffff',
				'type': 'polyline',
				'points': points
			}]
		}
	} catch (_) {
		showAlert(`Could not set up a layer of country borders. You may need to clear this website's data. If problem persists, contact the developer.`)
	}

	return data
}

/**
 * @param {string} player 
 * @param {boolean} showOnlineStatus 
 * @returns 
 */
async function lookupPlayer(player, showOnlineStatus = true) {
	if (document.querySelector('#player-lookup') != null) document.querySelector('#player-lookup').remove()
	if (document.querySelector('#player-lookup-loading') != null) document.querySelector('#player-lookup-loading').remove()
	const loading = addElement(document.querySelector('.leaflet-top.leaflet-left'), htmlCode.playerLookupLoading, '#player-lookup-loading')

	const query = { query: [player] }
	const players = await fetchJSON(`${OAPI_BASE}/${CURRENT_MAP}/players`, { method: 'POST', body: JSON.stringify(query) })
	if (players == false) return showAlert('Unexpected error occurred while looking the player up, please try later.')
	if (players == null) return showAlert('Service is currently unavailable, please try later.')

	loading.remove()
	const lookup = addElement(document.querySelector('.leaflet-top.leaflet-left'), htmlCode.playerLookup, '#player-lookup')

	// Populate with placeholders
	lookup.insertAdjacentHTML('beforeend', '{show-online-status}<br>')
	lookup.insertAdjacentHTML('beforeend', '<img id="player-lookup-avatar"/>')
	lookup.insertAdjacentHTML('beforeend', '<center><b id="player-lookup-name">{player}</b>{about}</center>')
	lookup.insertAdjacentHTML('beforeend', '<hr>{town}{nation}')
	lookup.insertAdjacentHTML('beforeend', 'Rank: <b>{rank}</b><br>')
	lookup.insertAdjacentHTML('beforeend', 'Balance: <b>{balance} gold</b><br>')
	lookup.insertAdjacentHTML('beforeend', '{last-online}')
	lookup.insertAdjacentHTML('beforeend', '<span class="close-container">X</span>')

	const player = players[0]

	// Gather data
	const isOnline = player.status.isOnline
	const balance = player.stats.balance
	const town = player.town.name
	const nation = player.nation.name
	const lastOnline = new Date(player.timestamps.lastOnline).toLocaleDateString('fr')
	let onlineStatus = '<span id="player-lookup-online" style="color: {online-color}">{online}</span>'
	const about = (!player.about || player.about == '/res set about [msg]') ? '' : `<br><i>${player.about}</i>`
	let rank = 'Townless'
	if (player.status.hasTown) rank = 'Resident'
	if (player.ranks.townRanks.includes('Councillor')) rank = 'Councillor'
	if (player.status.isMayor) rank = 'Mayor'
	if (player.ranks.nationRanks.includes('Chancellor')) rank = 'Chancellor'
	if (player.status.isKing) rank = 'Leader'

	// Place data
	const playerAvatarURL = 'https://mc-heads.net/avatar/' + player.uuid.replaceAll('-', '')
	document.querySelector('#player-lookup-avatar').setAttribute('src', playerAvatarURL)
	lookup.innerHTML = lookup.innerHTML
		.replace('{player}', player)
		.replace('{about}', about)
		.replace('{show-online-status}', showOnlineStatus ? onlineStatus : '')
		.replace('{online-color}', isOnline ? 'green' : 'red')
		.replace('{online}', isOnline ? '⚫︎ Online' : '○ Offline')
		.replace('{town}', town ? `Town: <b>${town}</b><br>` : '')
		.replace('{nation}', nation ? `Nation: <b>${nation}</b><br>` : '')
		.replace('{rank}', rank)
		.replace('{balance}', balance)
		.replace('{last-online}', !isOnline ? `Last online: <b>${lastOnline}</b><br>` : '')
	lookup.querySelector('.close-container').addEventListener('click', event => { event.target.parentElement.remove() })
}

async function getAlliances() {
	const alliances = await fetchJSON(`${CAPI_BASE}/${CURRENT_MAP}/alliances`)
	if (!alliances) {
		const cache = JSON.parse(localStorage['emcdynmapplus-alliances'])
		if (cache == null) {
			showAlert('Service responsible for loading alliances will be available later.')
			return []
		}
		showAlert('Service responsible for loading alliances is currently unavailable, but locally-cached data will be used.')
		return cache
	}

	const finalArray = []
	for (const alliance of alliances) {
		const allianceType = alliance.type.toLowerCase() || 'mega'
		if (allianceType == 'sub') continue
		finalArray.push({
			name: alliance.fullName || alliance.allianceName,
			type: allianceType == 'mega' ? 'meganations' : 'alliances',
			nations: alliance.nations,
			colours: alliance.colours || { fill: '#000000', outline: '#000000' } // Black
		})
	}

	localStorage['emcdynmapplus-alliances'] = JSON.stringify(finalArray)
	return finalArray
}

async function getArchive(data) {
	const loadingMessage = addElement(document.body, htmlCode.alertMsg.replace('{message}', 'Loading archive, please wait...'), '.message')

	const archiveWebsite = `https://web.archive.org/web/${archiveDate()}id_/`
	// markers.json URL changed over time
	let markersURL = 'https://map.earthmc.net/tiles/minecraft_overworld/markers.json'
	if (archiveDate() < 20230212) {
		markersURL = 'https://earthmc.net/map/aurora/tiles/_markers_/marker_earth.json'
	} else if (archiveDate() < 20240701) {
		markersURL = 'https://earthmc.net/map/aurora/standalone/MySQL_markers.php?marker=_markers_/marker_earth.json'
	}
	markersURL = archiveWebsite + markersURL

	let archive = await fetchJSON(PROXY_URL + markersURL)
	if (!archive) return showAlert('Archive service is currently unavailable, please try later.')
	let actualArchiveDate

	// Structure of markers.json changed
	if (archiveDate() < 20240701) {
		data[0].markers = convertOldMarkersStructure(archive.sets['townyPlugin.markerset'])
		actualArchiveDate = archive.timestamp
	} else {
		data = archive
		actualArchiveDate = archive[0].timestamp
	}

	actualArchiveDate = new Date(parseInt(actualArchiveDate)).toLocaleDateString('en-ca')
	document.querySelector('#current-map-mode-label').textContent += ` (${actualArchiveDate})`
	loadingMessage.remove()
	if (actualArchiveDate.replaceAll('-', '') != archiveDate()) {
		showAlert(`The closest archive to your prompt comes from ${actualArchiveDate}.`)
	}

	return data
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

	// TODO: Check that the data is valid

	const modified =
		isMarkers ? main(data) : 
		isSettings ? modifySettings(data) : data;

	return new Response(JSON.stringify(modified))
}