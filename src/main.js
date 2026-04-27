/** WHERE MAIN LOGIC HAPPENS. ANYTHING NOT RELATING TO HTTP/SETUP/DOM BELONGS HERE */
//console.log('emcdynmapplus: loaded main')

// Add clickable player nameplates
waitForElement('.leaflet-nameplate-pane').then(element => {
	element.addEventListener('click', event => {
		const username = event.target.textContent || event.target.parentElement.parentElement.textContent
		if (username.length > 0) {
			// TODO: We don't need to send a request every click. Use a ~10s expiring cache.
			lookupPlayer(username, false)
		}
	})
})

/** @type {Array<ParsedMarker>} */
let parsedMarkers = []

/** @type {Array<Alliance>} */
let cachedAlliances = null

/** @type {Map<string, any>} */
let cachedApiNations = null

const BORDER_CHUNK_COORDS = /** @type {const} */ ({ 
	L: -33280, R: 33088,
	U: -16640, D: 16512
})

const EXTRA_BORDER_OPTS = {
	label: "Country Border",
	opacity: 0.5,
	weight: 3,
	color:  "#000000",
	markup: false,
}

// Black
const DEFAULT_ALLIANCE_COLOURS = { fill: '#000000', outline: '#000000' }
const CHUNKS_PER_RES = 12
const DAY_MS = 86_400_000 // 24hr in millisec

const archiveDate = () => parseInt(localStorage['emcdynmapplus-archive-date'])

/** @type {() => Array<{color: string | null, input: string | null}>} */
const nationClaimsInfo = () => JSON.parse(localStorage['emcdynmapplus-nation-claims-info'] || '[]')

/** @param {string} str */
const isNumeric = (str) => Number.isFinite(+str)

/** @param {number} num */
const roundTo16 = (num) => Math.round(num / 16) * 16

/** 
 * Fowler-Noll-Vo hash function
 * @param {string} str
 */
function hashCode(str) {
	let hexValue = 0x811c9dc5
	for (let i = 0; i < str.length; i++) {
		hexValue ^= str.charCodeAt(i)
		hexValue += (hexValue << 1) + (hexValue << 4) + (hexValue << 7) + (hexValue << 8) + (hexValue << 24)
	}

	return '#' + ((hexValue >>> 0) % 16777216).toString(16).padStart(6, '0')
}

/**
 * Shoelace formula
 * @param {Polygon} vertices 
 */
function calcPolygonArea(vertices) {
	let area = 0
	const amtVerts = vertices.length
	for (let i = 0; i < amtVerts; i++) {
		const j = (i + 1) % amtVerts

		// Vertices need rounding to 16 because data has imprecise coordinates
		area += roundTo16(vertices[i].x) * roundTo16(vertices[j].z)
		area -= roundTo16(vertices[j].x) * roundTo16(vertices[i].z)
	}

	return (Math.abs(area) / 2) / (16 * 16)
}

/**
 * Computes total area of a marker, accounting for holes.
 * @param {SquaremapMarker} marker
 * @returns {number}
 */
function calcMarkerArea(marker) {
    if (marker.type !== 'polygon') return 0

    let area = 0
    const processed = [] // Temp array of polys used to check existence of holes
    for (const multiPolygon of marker.points || []) {
        for (let polygon of multiPolygon) {
            if (!polygon || polygon.length < 3) continue

			// Filter out any NaN points
			polygon = polygon
				.map(v => ({ x: Number(v.x), z: Number(v.z) }))
				.filter(v => Number.isFinite(v.x) && Number.isFinite(v.z))
            
            if (polygon.length < 3) continue

            // Check if polygon is fully inside any previous polygon
            const isHole = processed.some(prev => polygon.every(v => pointInPolygon(v, prev)))
            area += isHole ? -calcPolygonArea(polygon) : calcPolygonArea(polygon)
            processed.push(polygon)
        }
    }

    return area
}

/**
 * Credit: James Halliday (substack)
 * @param {Vertex} vertex 
 * @param {Polygon} polygon
 */
function pointInPolygon(vertex, polygon) {
	let { x, z } = vertex
	let n = polygon.length
	let inside = false
	for (let i = 0, j = n - 1; i < n; j = i++) {
		let xi = polygon[i].x, xj = polygon[j].x
		let zi = polygon[i].z, zj = polygon[j].z

		let intersect = ((zi > z) != (zj > z))
			&& (x < (xj - xi) * (z - zi) / (zj - zi) + xi)
		if (intersect) inside = !inside
	}

	return inside
}

/** @param {number} n */
const roundToNearest16 = n => Math.round(n / 16) * 16

/**
 * @param {Polygon} vertices 
 * @returns {Vertex}
 */
function midrange(vertices) {
	let minX = Infinity, maxX = -Infinity
	let minZ = Infinity, maxZ = -Infinity

	for (const vert of vertices) {
		if (vert.x < minX) minX = vert.x
		if (vert.x > maxX) maxX = vert.x
		if (vert.z < minZ) minZ = vert.z
		if (vert.z > maxZ) maxZ = vert.z
	}

	return {
		x: roundToNearest16((minX + maxX) / 2),
		z: roundToNearest16((minZ + maxZ) / 2)
	}
}

/**
 * @param {MarkerPoints} linePoints
 * @param {string} weight 
 * @param {string} colour 
 */
const makePolyline = (linePoints, weight = 1, colour = '#ffffff') => ({
	'type': 'polyline', 'points': linePoints,
	'weight': weight, 'color': colour,
})

/** 
 * @param {MarkersResponse} data - The markers response JSON data. 
 */
async function modifyMarkers(data) {
	const mapMode = currentMapMode()
	console.log(`Modifying markers according to current map mode: ${mapMode.name}`)

	const borders = isUserscript() ? BORDERS : await fetch(chrome.runtime.getURL('resources/borders.json')).then(r => r.json())
	if (!borders) showAlert("An unexpected error occurred fetching the borders resource file.")
	else {
		for (const key in borders) {
			borders[key] = { ...borders[key], ...EXTRA_BORDER_OPTS }
		}
		addCountryBordersLayer(data, borders)
	}

	if (mapMode == MapMode.ARCHIVE) {
		data = await getArchive(data)
	}

	if (!data?.[0]?.markers?.length) {
		showAlert('Unexpected error occurred while loading the map, EarthMC may be down. Try again later.')
		return data
	}

	const isAllianceMode = mapMode == MapMode.ALLIANCES || mapMode == MapMode.MEGANATIONS
    if (isAllianceMode && cachedAlliances == null) {
        cachedAlliances = await getAlliances()
    }

	if (mapMode == MapMode.OVERCLAIM && cachedApiNations == null) {
		const url = `${currentMapApiUrl()}/nations`
		const nlist = await fetchJSON(url) // GET
		const apiNations = await queryConcurrent(url, nlist) // POST
		cachedApiNations = new Map(apiNations.map(n => [n.name.toLowerCase(), n]))
	}

	// Get current local storage values
	const date = archiveDate()
	const isSquaremap = mapMode != MapMode.ARCHIVE || date >= 20240701

	const claimsCustomizerInfo = new Map(nationClaimsInfo()
		.filter(obj => obj.input != null)
		.map(obj => [obj.input?.toLowerCase(), obj.color])
	)

	const useOpaque = localStorage['emcdynmapplus-nation-claims-opaque-colors'] == 'true' ? true : false
	const showExcluded = localStorage['emcdynmapplus-nation-claims-show-excluded'] == 'true' ? true : false

	const start = performance.now()
	for (const marker of data[0].markers) {
		if (marker.type != 'polygon' && marker.type != 'icon') continue

		const parsedInfo = isSquaremap ? modifyDescription(marker, mapMode) : modifyDynmapDescription(marker, date)
		if (marker.type != 'polygon') continue

		parsedMarkers.push(parsedInfo)

		// Universal properties
		marker.opacity = 1
		marker.fillOpacity = 0.33
		marker.weight = 1.5

		if (mapMode == MapMode.DEFAULT || mapMode == MapMode.ARCHIVE) continue
		if (mapMode == MapMode.NATIONCLAIMS) {
			colorTownNationClaims(marker, parsedInfo.nationName, claimsCustomizerInfo, useOpaque, showExcluded)
			continue
		}

		// All other modes (alliances, meganations, overclaim)
		colorTown(marker, parsedInfo, mapMode)
	}
	
	const elapsed = (performance.now() - start)
	console.log(`emcdynmapplus: modified description and colour of all markers. took ${elapsed.toFixed(2)}ms`)

	return data
}

const isAurora = CURRENT_MAP === 'aurora'

// Hand-picked constants
// 1.94 is how many times Nostra's map is horizontally bigger than Aurora's
const SCALE_X = isAurora ? 1.0015 : 1.94133 // Aurora is slightly stretched horizontally
const MOVE_DOWN = isAurora ? 0 : 8175 // How much to move the layer down by
const MOVE_RIGHT = isAurora ? 0 : 382.5 // How much to move the layer right by

/**
 * Projects the Z coordinate for the current map.
 * Aurora uses raw coordinates (borders are Plate Carree), while Nostra uses Miller projection.
 * @param {number} z
 * @returns {number}
 */
const projectZ = z => isAurora ? z : millerProjection(z) + MOVE_DOWN

/**
 * @param {MarkersResponse} data - The markers response JSON data.
 * @param {Object} borders - The borders JSON data.
 */
function addCountryBordersLayer(data, borders) {
	const isAurora = CURRENT_MAP == 'aurora'
	try {
		const points = Object.keys(borders).map(country => {
			/** @type {Polygon} */
			const countryPoly = []
			const line = borders[country]
			for (let i = 0; i < line.x.length; i++) {
				const xCoord = line.x[i]
				if (!isNumeric(xCoord)) continue

				const zCoord = line.z[i]
				countryPoly.push(isAurora ? { x: xCoord * SCALE_X, z: zCoord } : {
					x: xCoord * SCALE_X + MOVE_RIGHT,
					z: millerProjection(zCoord) + MOVE_DOWN
				})
			}

			return countryPoly
		})

		data.push({
			'name': 'Country Borders',
			'id': 'borders',
			'order': 125, // Put it before the last layer 'Folia Regions' (150) but after the 'Chunk Borders' (100) layer.
			'hide': false,
			'control': true,
			'markers': [makePolyline(points)]
		})
	} catch (e) {
		showAlert(`Could not set up a layer of country borders. You may need to clear this website's data. If problem persists, contact the developer.`)
		console.error(e)
		return null
	}
}

/**
 * Modifies a town description of a Squaremap marker.
 * @param {SquaremapMarker} marker
 * @param {MapMode} mapMode - The currently selected map mode.
 * 
 * @returns {ParsedMarker}
 */
function modifyDescription(marker, mapMode) {
	const town = marker.tooltip.match(/<b>(.*)<\/b>/)[1]
	const nation = marker.tooltip.match(/\(\b(?:Member|Capital)\b of (.*)\)\n/)?.[1]
	const isCapital = marker.tooltip.match(/\(Capital of (.*)\)/) != null
	const mayor = marker.popup.match(/Mayor: <b>(.*)<\/b>/)?.[1]

	const residents = marker.popup.match(/<\/summary>\n    \t(.*)\n   \t<\/details>/)?.[1]
	const residentNum = residents.split(', ').length

	const councillors = marker.popup.match(/Councillors: <b>(.*)<\/b>/)?.[1]
		.split(', ').filter(councillor => councillor != 'None')

	// Fix a bug with names that are wrapped in angle brackets
	const fixedTownName = town.replaceAll('<', '&lt;').replaceAll('>', '&gt;')
	const fixedNationName = nation?.replaceAll('<', '&lt;').replaceAll('>', '&gt;') ?? nation

	const area = calcMarkerArea(marker) // Area excluding interior holes

	let location = { x: 0, z: 0 }
	if (marker.points) location = midrange(marker.points.flat(2))

	// Create clickable resident lists
	const isArchiveMode = mapMode == MapMode.ARCHIVE
	const residentList = isArchiveMode ? residents :
		residents.split(', ').map(resident => INSERTABLE_HTML.residentClickable.replaceAll('{player}', resident)).join(', ')
	const councillorList = isArchiveMode ? councillors :
		councillors.map(councillor => INSERTABLE_HTML.residentClickable.replaceAll('{player}', councillor)).join(', ')

	// Modify description
	if (residentNum > 50) {
		marker.popup = marker.popup.replace(residents, INSERTABLE_HTML.scrollableResidentList.replace('{list}', residentList))
	} else {
		marker.popup = marker.popup.replace(residents + '\n', INSERTABLE_HTML.residentList.replace('{list}', residentList) + '\n')
	}

	marker.popup = marker.popup
		.replace('</details>\n   \t<br>', '</details>') // Remove line break
		.replace('Councillors:', `Size: <b>${area} chunks</b><br/>Councillors:`) // Add size info
		.replace('<i>/town set board [msg]</i>', '<i></i>') // Remove default town board
		.replace('<i></i> \n    <br>\n', '') // Remove empty town board
		.replace('\n    <i>', '\n    <i style="overflow-wrap: break-word">') // Wrap long town board
		.replace('Councillors: <b>None</b>\n\t<br>', '') // Remove none councillors info
		.replace('Size: <b>0 chunks</b><br/>', '') // Remove 0 chunks town size info
		.replace(town, fixedTownName)
		.replace(nation, fixedNationName)
		.replaceAll('<b>false</b>', '<b><span style="color: red">No</span></b>') // 'False' flag
		.replaceAll('<b>true</b>', '<b><span style="color: green">Yes</span></b>') // 'True' flag
	
	if (!isArchiveMode) {
		marker.popup = marker.popup
		.replace(/Mayor: <b>(.*)<\/b>/, `Mayor: <b>${INSERTABLE_HTML.residentClickable.replaceAll('{player}', mayor)}</b>`) // Lookup mayor
		.replace(/Councillors: <b>(.*)<\/b>/, `Councillors: <b>${councillorList}</b>`) // Lookup a councillor in the list
	}
	if (isCapital) {
		// Prepend star indicating a capital
		marker.popup = marker.popup.replace('<span style="font-size:120%;">', '<span style="font-size: 120%">★ ')
	}

	marker.tooltip = marker.tooltip
		.replace('<i>/town set board [msg]</i>', '<i></i>')
		.replace('<br>\n    <i></i>', '')
		.replace('\n    <i>', '\n    <i id="clamped-board">') // Clamp long town board
		.replace(town, fixedTownName)
		.replace(nation, fixedNationName)

	if (mapMode == MapMode.ALLIANCES || mapMode == MapMode.MEGANATIONS) {
		// Add 'Part of' label
		const nationAlliances = getNationAlliances(nation, mapMode)
		if (nationAlliances.length > 0) {
			const allianceList = nationAlliances.map(alliance => alliance.name).join(', ')
			const partOfLabel = INSERTABLE_HTML.partOfLabel.replace('{allianceList}', allianceList)
			marker.popup = marker.popup.replace('</span>\n', '</span></br>' + partOfLabel)
		}
	}

	return {
		townName: fixedTownName, 
		nationName: fixedNationName,
		residentNum, residentList: residents.split(', '), 
		isCapital, mayor, area, ...location
	}
}

/**
 * Modifies a town description of a Dynmap archive marker.
 * @param {DynmapMarker} marker 
 * @param {number} curArchiveDate - Date as a number in the format YYYYDDMM
 * @returns {ParsedMarker}
 */
function modifyDynmapDescription(marker, curArchiveDate) {
	const membersTitle = marker.popup.match(/Members <span/) ? 'Members' : 'Associates'
	const residents = marker.popup.match(`${membersTitle} <span style="font-weight:bold">(.*)<\/span><br \/>Flags`)?.[1]
	const residentList = residents?.split(', ') ?? []
	const residentNum = residentList.length
	const isCapital = marker.popup.match(/capital: true/) != null
	const area = calcPolygonArea(marker.points)
	const location = midrange(marker.points.flat(2))

	// Modify description
	if (isCapital) marker.popup = marker.popup.replace('120%">', '120%">★ ') // Prepend star indicating a capital
	if (curArchiveDate < 20220906) {
		marker.popup = marker.popup.replace(/">hasUpkeep:.+?(?<=<br \/>)/, '; white-space:pre">')
	}
	else marker.popup = marker.popup.replace('">pvp:', '; white-space:pre">pvp:')

	marker.popup = marker.popup
		.replace("Mayor", "Mayor:")
		.replace('Flags<br />', '<br>Flags<br>')
		.replace('>pvp:', '>PVP allowed:')
		.replace('>mobs:', '>Mob spawning:')
		.replace('>public:', '>Public status:')
		.replace('>explosion:', '>Explosions:&#9;')
		.replace('>fire:', '>Fire spread:&#9;')
		.replace(/<br \/>capital:.*<\/span>/, '</span>')
		.replaceAll('true<', '&#9;<span style="color:green">Yes</span><')
		.replaceAll('false<', '&#9;<span style="color:red">No</span><')
		.replace(`${membersTitle} <span`, `${membersTitle} <b>[${residentNum}]</b> <span`)
	if (area > 0) {
		marker.popup = marker.popup
		.replace(`</span><br /> ${membersTitle}`, `</span><br>Size:<span style="font-weight:bold"> ${area} chunks</span><br> ${membersTitle}`)
	}
	// Scrollable resident list
	if (residentNum > 50) {
		marker.popup = marker.popup
			.replace(`<b>[${residentNum}]</b> <span style="font-weight:bold">`,
				`<b>[${residentNum}]</b> <div id="scrollable-list"><span style="font-weight:bold">`)
			.replace('<br>Flags', '</div><br>Flags')
	}

	// Strip all HTML tags and leading star so we can get town and nation names.
	const clean = marker.popup.replace(/<[^>]+>/g, '').trim().replace(/^★\s*/, '')
	const [, town, nation] = (clean.match(/^(.+?)\s*\((.+?)\)/) || [])

	return {
		townName: town?.trim() || null,
		nationName: nation?.trim() || null,
		residentList, residentNum, 
		isCapital, area, ...location
	}
}

/** 
 * Sets the colours of a marker with optional weight and returns it back.
 * @param {Marker} marker 
 */
const colorMarker = (marker, fill, outline, weight=null) => {
	marker.fillColor = fill
	marker.color = outline
	if (weight) marker.weight = weight
}

const DEFAULT_BLUE = '#3fb4ff'
const DEFAULT_GREEN = '#89c500'

/**
 * @param {Marker} rawMarker
 * @param {ParsedMarker} parsedMarker
 * @param {MapMode} mapMode - The currently selected map mode.
 */
function colorTown(rawMarker, parsedMarker, mapMode) {
	const mayor = rawMarker.popup.match(/Mayor: <b>(.*)<\/b>/)?.[1]
	const isRuin = !!mayor?.match(/NPC[0-9]+/)
	if (isRuin) return colorMarker(rawMarker, '#000000', '#000000')

	const { nationName } = parsedMarker

	if (mapMode == MapMode.MEGANATIONS) {
		const isDefaultCol = rawMarker.color == DEFAULT_BLUE && rawMarker.fillColor == DEFAULT_BLUE
		rawMarker.color = isDefaultCol ? '#363636' : DEFAULT_GREEN
		rawMarker.fillColor = isDefaultCol ? hashCode(nationName) : rawMarker.fillColor
	}
	else if (mapMode == MapMode.OVERCLAIM) {
		const nation = nationName ? cachedApiNations.get(nationName.toLowerCase()) : null
		const overclaimInfo = !nation
			? checkOverclaimedNationless(parsedMarker.area, parsedMarker.residentNum)
			: checkOverclaimed(parsedMarker.area, parsedMarker.residentNum, nation.stats.numResidents)

		const colour = overclaimInfo.isOverclaimed ? '#ff0000' : '#00ff00'
		colorMarker(rawMarker, colour, colour, overclaimInfo.isOverclaimed ? 2 : 0.5)
	}
	else colorMarker(rawMarker, '#000000', '#000000', 1) // 'alliances' mode

	// Properties for alliances and meganations
	const nationAlliances = getNationAlliances(nationName, mapMode)
	if (nationAlliances.length == 0) return
	
	const { colours } = nationAlliances[0] // First alliance in related alliances
	const newWeight = nationAlliances.length > 1 ? 1.5 : 0.75 // Use bolder weight if many related alliances
	return colorMarker(rawMarker, colours.fill, colours.outline, newWeight)
}

/**
 * @param {Marker} marker
 * @param {string} nationName
 * @param {Map<string|null, string|null>} claimsCustomizerInfo
 */
function colorTownNationClaims(marker, nationName, claimsCustomizerInfo, useOpaque, showExcluded) {
	//const strippedName = nationName?.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
	const nationColorInput = claimsCustomizerInfo.get(nationName?.toLowerCase())
	if (!nationColorInput) {
		if (useOpaque) marker.fillOpacity = marker.opacity = 0.5
		if (!showExcluded) marker.fillOpacity = marker.opacity = 0 // Make town invisible if not part of a nation in claims customizer.

		return colorMarker(marker, '#000000', '#000000', 1)
	}

	if (useOpaque) marker.fillOpacity = marker.opacity = 1 // 100% opacity similar to manual player drawn claim maps
	return colorMarker(marker, nationColorInput, nationColorInput, 1.5)
}

/**
 * @param {string} playerName
 * @param {boolean} showOnlineStatus 
 */
async function lookupPlayer(playerName, showOnlineStatus = true) {
	document.querySelector('#player-lookup')?.remove()
	document.querySelector('#player-lookup-loading')?.remove()
	
	const leafletTL = document.querySelector('.leaflet-top.leaflet-left')
	if (!leafletTL) return showAlert('Error selecting element required to show player info popup.')

	const loading = addElement(leafletTL, INSERTABLE_HTML.playerLookupLoading, '#player-lookup-loading')
	const players = await postJSON(`${currentMapApiUrl()}/players`, { query: [playerName] })

	loading.remove()

	if (!players) return showAlert('Service is currently unavailable, please try later.', 5)
	if (players.length < 1) return showAlert(`Error looking up player: ${playerName}. They have possibly opted-out.`, 3)
	
	const player = players[0]
	const hasTown = player.town && player.town.uuid

	// Insert and populate with placeholders
	const lookup = addElement(leafletTL, INSERTABLE_HTML.playerLookup)
	lookup.insertAdjacentHTML('beforeend', '<span class="close-container">X</span>')
	lookup.insertAdjacentHTML('beforeend', '{show-online-status}<br>')
	lookup.insertAdjacentHTML('beforeend', '<img id="player-lookup-avatar"/>')
	lookup.insertAdjacentHTML('beforeend', '<center><b id="player-lookup-name">{player}</b>{about}</center>')
	lookup.insertAdjacentHTML('beforeend', '<hr>{town}{nation}')
	lookup.insertAdjacentHTML('beforeend', 'Rank: <b>{rank}</b><br>')
	lookup.insertAdjacentHTML('beforeend', 'Balance: <b>{balance} gold</b><br>')
	lookup.insertAdjacentHTML('beforeend', '{registered}')
	if (hasTown) lookup.insertAdjacentHTML('beforeend', '{town-join}')
	lookup.insertAdjacentHTML('beforeend', '{last-online}')

	// Gather data
	const isOnline = player.status.isOnline
	const balance = player.stats.balance
	const town = player.town.name
	const nation = player.nation.name

	const registeredDate = new Date(player.timestamps.registered).toLocaleDateString()
	const townJoinDate = new Date(player.timestamps.joinedTownAt || 0).toLocaleDateString()
	const loDate = new Date(player.timestamps.lastOnline).toLocaleDateString()

	let onlineStatus = '<span id="player-lookup-online" style="color: {online-color}">{online}</span>'
	const about = (!player.about || player.about == '/res set about [msg]') ? '' : `<br><i>${player.about}</i>`
	let rank = 'Townless'
	if (player.status.hasTown) rank = 'Resident'
	if (player.ranks.townRanks.includes('Councillor')) rank = 'Councillor'
	if (player.status.isMayor) rank = 'Mayor'
	if (player.ranks.nationRanks.includes('Chancellor')) rank = 'Chancellor'
	if (player.status.isKing) rank = 'Leader'

	// Place data
	const playerAvatarURL = `https://mc-heads.net/avatar/${player.uuid.replaceAll('-', '')}`
	document.querySelector('#player-lookup-avatar').setAttribute('src', playerAvatarURL)
	lookup.innerHTML = lookup.innerHTML
		.replace('{player}', player.name || playerName)
		.replace('{about}', about)
		.replace('{show-online-status}', showOnlineStatus ? onlineStatus : '')
		.replace('{online-color}', isOnline ? 'green' : 'red')
		.replace('{online}', isOnline ? '⚫︎ Online' : '○ Offline')
		.replace('{town}', town ? `Town: <b>${town}</b><br>` : '')
		.replace('{nation}', nation ? `Nation: <b>${nation}</b><br>` : '')
		.replace('{rank}', rank)
		.replace('{balance}', balance)
		.replace('{registered}', `Registered:<br><b>${registeredDate}</b> (${timeAgo(player.timestamps.registered)})`)

	if (hasTown) {
		const townJoinStr = `<br>Joined town:<br><b>${townJoinDate}</b> (${timeAgo(player.timestamps.joinedTownAt)})`
		lookup.innerHTML = lookup.innerHTML.replace('{town-join}', townJoinStr)
	}
	
	const onlineStr = !isOnline ? `<br>Last online:<br><b>${loDate}</b> (${timeAgo(player.timestamps.lastOnline)})` : ''
	lookup.innerHTML = lookup.innerHTML.replace('{last-online}', onlineStr)

	lookup.querySelector('.close-container').addEventListener('click', event => { event.target.parentElement.remove() })
}

/**
 * Formats a timestamp into a string. Ex: "Today", "2 days ago", "3 months ago" or "1 year ago" 
 * @param {number} ts The UNIX timestamp to format 
 */
function timeAgo(ts) {
	const diff = Date.now() - ts
	const units = [['year', 365*DAY_MS], ['month', 30*DAY_MS], ['day', DAY_MS]]
	for (const [name, ms] of units) {
		const v = Math.floor(diff / ms)
		if (v >= 1) return `${v} ${name}${v > 1 ? 's' : ''} ago`
	}

	return 'Today'
}

/**
 * @param {AllianceColours} colours  
 */
function parseColours(colours) {
	if (!colours) return DEFAULT_ALLIANCE_COLOURS
	colours.fill = "#" + colours.fill.replaceAll("#", "")
	colours.outline = "#" + colours.outline.replaceAll("#", "")
	return colours
}

async function getAlliances() {
	const alliances = await fetchJSON(`${CAPI_BASE}/${CURRENT_MAP}/alliances`)
	if (!alliances) {
		try {
			const cache = JSON.parse(localStorage['emcdynmapplus-alliances'])
			if (!cache) throw new Error('No alliance data in cache')

			for (const alliance of cache) {
				const [ownNations, puppetNations] = [alliance.ownNations || [], alliance.puppetNations || []]
				alliance._nationSet = new Set([...ownNations, ...puppetNations])
			}

			showAlert('Service responsible for loading alliances is unavailable, falling back to locally cached data.', 5)
			return cache
		} catch (_) {
			showAlert('Service responsible for loading alliances will be available later.')
		}
		
		return []
	}

	// Build map of parentAlliance (identifier) -> child alliances for O(1) lookup
	const childrenByParent = new Map()
	for (const a of alliances) {
		if (!a.parentAlliance) continue

		const arr = childrenByParent.get(a.parentAlliance) || []
		arr.push(a)
		childrenByParent.set(a.parentAlliance, arr)
	}

	/** @type {Array<Alliance>} */
	const allianceData = []
	for (const a of alliances) {
		const allianceType = a.type?.toLowerCase() || 'mega'
		//if (alliance.parentAlliance) continue // this is a child alliance, skip it

		const children = childrenByParent.get(a.identifier) || []
		const puppetNations = children.flatMap(a => a.ownNations || [])
		const ownNations = a.ownNations || []

		allianceData.push({
			name: a.label || a.identifier,
			modeType: allianceType == 'mega' ? 'meganations' : 'alliances',
			colours: parseColours(a.optional.colours),
			ownNations, puppetNations,
			_nationSet: new Set([...ownNations, ...puppetNations])
		})
	}

	localStorage['emcdynmapplus-alliances'] = JSON.stringify(allianceData)
	return allianceData
}

/**
 * Gets all alliances the input nation exists within / is related to.
 * @param {string} nationName - The name of the nation to get related alliances.
 * @param {MapMode} mapMode - The currently selected map mode.
 */
function getNationAlliances(nationName, mapMode) {
	if (cachedAlliances == null) return []

	/** @type {Array<{name: string, colours: AllianceColours}>} */
	const nationAlliances = []
	for (const alliance of cachedAlliances) {
		if (alliance.modeType != mapMode.name) continue
		if (!alliance._nationSet.has(nationName)) continue

		nationAlliances.push({ name: alliance.name, colours: alliance.colours })
	}

	return nationAlliances
}

/** @param {Object} markers - The old markers response JSON data */
async function getArchive(data) {
	const loadingAlert = showAlert('Loading archive, please wait...', 10)
	const date = archiveDate()

	try {
		const archive = await fetchArchive(date)

		let actualArchiveDate // Structure of markers.json changed at some point
		if (date < 20240701) {
			data[0].markers = convertOldMarkersStructure(archive.sets['townyPlugin.markerset'])
			actualArchiveDate = archive.timestamp
		} else {
			data = archive
			actualArchiveDate = archive[0].timestamp
		}

		// THIS HAS TO BE EN-CA SO REPLACING DASHES WORKS TO MATCH STORED DATE
		actualArchiveDate = new Date(parseInt(actualArchiveDate)).toLocaleDateString('en-ca')
		document.querySelector('#current-map-mode-label').textContent += ` (${actualArchiveDate})`
		
		loadingAlert.remove()
		if (actualArchiveDate.replaceAll('-', '') != date) {
			showAlert(`The closest archive to your prompt comes from ${actualArchiveDate}.`)
		}

		return data
	} catch (e) {
		console.error(e)
		return showAlert('Archive service is currently unavailable, please try later.', 5)
	}
}

/** @param {Object} markerset - The towny markerset of the old markers response JSON data */
function convertOldMarkersStructure(markerset) {
	return Object.entries(markerset.areas).filter(([key]) => !key.includes('_Shop')).map(([_, v]) => ({
		fillColor: v.fillcolor,
		color: v.color,
		popup: v.desc ?? `<div><b>${v.label}</b></div>`,
		weight: v.weight,
		opacity: v.opacity,
		type: 'polygon',
		points: v.x.map((x, i) => ({ x, z: v.z[i] }))
	}))
}

/**
 * Calculate the claim limit for an independent town and report overclaimed status.
 * @param {number} claimedChunks 
 * @param {number} numResidents 
 */
function checkOverclaimedNationless(claimedChunks, numResidents) {
    const resLimit = numResidents * CHUNKS_PER_RES
    const isOverclaimed = claimedChunks > resLimit

    // Calculate how much the town is overclaimed by, if applicable
    return { 
		isOverclaimed,
		chunksOverclaimed: isOverclaimed ? claimedChunks - resLimit : 0,
		resLimit
	}
}

/**
 * Calculate the claim limit for a town with a nation and report overclaimed status.
 * @param {number} claimedChunks
 * @param {number} numResidents
 * @param {number} numNationResidents
 */
function checkOverclaimed(claimedChunks, numResidents, numNationResidents) {
	const bonus = auroraNationBonus(numNationResidents)

    const resLimit = numResidents * CHUNKS_PER_RES
    const totalClaimLimit = resLimit + bonus
    const isOverclaimed = claimedChunks > totalClaimLimit
	
	return { 
		isOverclaimed,
		chunksOverclaimed: isOverclaimed ? claimedChunks - totalClaimLimit : 0,
		nationBonus: bonus,
		resLimit, totalClaimLimit
	}
}

/** @param {number} numNationResidents */
const auroraNationBonus = numNationResidents => numNationResidents >= 200 ? 100
	: numNationResidents >= 120 ? 80
	: numNationResidents >= 80 ? 60
	: numNationResidents >= 60 ? 50
	: numNationResidents >= 40 ? 30
	: numNationResidents >= 20 ? 10 : 0

const AURORA_ZBOUNDS = { min: -16640, max: 16508 } // Vertical bounds of old map (Plate Carree projection)
const NORTH_HEMISPHERE_FACTOR = 0.994 // Project from Plate Carree to Miller Cylindrical. Adjust projection of north hemisphere
const MAP_SCALE_FACTOR = 94704 / 33148 // Estimated height of new (Nostra) map if it wasn't cropped / Height of old map

// 16574 is a mean average of old map vertical bounds
// 2.304 is a magic number from 5/4 * Math.asinh(Math.tan(4/5 * (90 * (Math.PI / 180))))
const MILLER_Y_NORMALIZER = 16574 / 2.3034125433763912

function millerProjection(z) {
	// Converts old (Aurora) map's Z-coord to latitude. Assuming old map covers every latitude. 
	const latDeg = ((z - AURORA_ZBOUNDS.min) * 180 / (AURORA_ZBOUNDS.max - AURORA_ZBOUNDS.min)) - 90
	const latRad = latDeg * (Math.PI / 180)

	let millerOldZ = (5/4) * Math.asinh(Math.tan((4 / 5) * latRad)) * MILLER_Y_NORMALIZER
	if (millerOldZ < 0) millerOldZ *= NORTH_HEMISPHERE_FACTOR

	return millerOldZ * MAP_SCALE_FACTOR
}