/** WHERE MAIN LOGIC HAPPENS. ANYTHING NOT RELATING TO HTTP/SETUP/DOM BELONGS HERE */
console.log('emcdynmapplus: loaded main')

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

/** @type {Array<CachedAlliance>} */
let cachedAlliances = null

/** @type {Map<string, string>} */
let cachedApiNations = null

/** @typedef {typeof MAP_MODES[number]} MapMode */
const MAP_MODES = /** @type {const} */ (["default", "overclaim", "nationclaims", "meganations", "alliances"])
const BORDER_CHUNK_COORDS = { 
	L: -33280, R: 33088,
	U: -16640, D: 16512
}

const EXTRA_BORDER_OPTS = {
	label: "Country Border",
	opacity: 0.5,
	weight: 3,
	color:  "#000000",
	markup: false,
}

/** @type {() => MapMode} */
const currentMapMode = () => localStorage['emcdynmapplus-mapmode'] ?? 'meganations'
const archiveDate = () => parseInt(localStorage['emcdynmapplus-archive-date'])

/** @type {() => Array<{color: string | null, input: string | null}>} */
const nationClaimsInfo = () => JSON.parse(localStorage['emcdynmapplus-nation-claims-info'] || '[]')

function switchMapMode() {
	// Get the current stored mode, defaulting to the first mode in the list
	const currentMode = localStorage['emcdynmapplus-mapmode'] || MAP_MODES[0]
	const nextModeIndex = (MAP_MODES.indexOf(currentMode) + 1) % MAP_MODES.length
	const nextMode = MAP_MODES[nextModeIndex]

	localStorage['emcdynmapplus-mapmode'] = nextMode
	location.reload()
}

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

/**
 * @param {MarkerPoints} linePoints
 * @param {string} weight 
 * @param {string} colour 
 */
const makePolyline = (linePoints, weight = 1, colour = '#ffffff') => ({
	'type': 'polyline', 'points': linePoints,
	'weight': weight, 'color': colour,
})

/** @param {Array<any>} data - The markers response JSON data. */
async function modifyMarkers(data) {
	const mapMode = currentMapMode()
	if (mapMode == 'archive') {
		data = await getArchive(data)
	}

	if (!data?.[0]?.markers?.length) {
		showAlert('Unexpected error occurred while loading the map, EarthMC may be down. Try again later.')
		return data
	}

	const isAllianceMode = mapMode == 'alliances' || mapMode == 'meganations'
    if (isAllianceMode && cachedAlliances == null) {
        cachedAlliances = await getAlliances()
    }

	if (mapMode == 'overclaim' && cachedApiNations == null) {
		const nlist = await fetchJSON(`${OAPI_BASE}/${CURRENT_MAP}/nations`)
		const apiNations = await queryConcurrent(`${OAPI_BASE}/${CURRENT_MAP}/nations`, nlist)
		cachedApiNations = new Map(apiNations.map(n => [n.name.toLowerCase(), n]))
	}

	addChunksLayer(data)

	const isUserscript = typeof IS_USERSCRIPT !== 'undefined' && IS_USERSCRIPT
	const borders = isUserscript ? BORDERS : await fetch(chrome.runtime.getURL('resources/borders.json')).then(r => r.json())
	for (const key in borders) {
		borders[key] = { ...borders[key], ...EXTRA_BORDER_OPTS }
	}

	if (!borders) showAlert("An unexpected error occurred fetching the borders resource file.")
	else {
		addCountryBordersLayer(data, borders)
	}
	
	// Get current local storage values
	const date = archiveDate()
	const isSquaremap = mapMode != 'archive' || date >= 20240701

	const storedNationClaimsInfo = nationClaimsInfo()
	const claimsCustomizerInfo = new Map(storedNationClaimsInfo.map(obj => [obj.input?.toLowerCase(), obj.color]))

	const start = performance.now()
	for (const marker of data[0].markers) {
		if (marker.type != 'polygon' && marker.type != 'icon') continue
		
		const parsedInfo = isSquaremap ? modifyDescription(marker, mapMode) : modifyDynmapDescription(marker, date)
		if (marker.type != 'polygon') continue

		// Universal properties
		marker.opacity = 1
		marker.fillOpacity = 0.33
		marker.weight = 1.5

		if (mapMode == 'default') continue
		if (mapMode == 'nationclaims' || mapMode == 'archive') {
			// TODO: Is it worth supporting nation claim customizer in archive mode?
			colorTownNationClaims(marker, parsedInfo.nationName, claimsCustomizerInfo)
			continue
		}

		// All other modes (alliances, meganations, overclaim)
		colorTown(marker, parsedInfo, mapMode)
	}
	
	const elapsed = (performance.now() - start)
	console.log(`emcdynmapplus: modified description and colour of all markers. took ${elapsed.toFixed(2)}ms`)

	return data
}

/**
 * @param {Array<any>} data - The markers response JSON data.
 */
function addChunksLayer(data) {
	const { L, R, U, D } = BORDER_CHUNK_COORDS
	const ver = (x) => [{ x, z: U }, { x, z: D }, { x, z: U }]
	const hor = (z) => [{ x: L, z }, { x: R, z }, { x: L, z }]
	
	/** @type {MarkerPoints} */
	const chunkLines = []
	for (let x = L; x <= R; x += 16) chunkLines.push(ver(x))
	for (let z = U; z <= D; z += 16) chunkLines.push(hor(z))

	data[2] = {
		'name': 'Chunks',
		'id': 'chunks',
		'hide': true,
		'control': true,
		'markers': [makePolyline(chunkLines, 0.33, '#000000')]
	}
}

/**
 * @param {Array<any>} data - The markers response JSON data.
 * @param {Object} borders - The borders JSON data.
 */
function addCountryBordersLayer(data, borders) {
	try {
		const points = Object.keys(borders).map(country => {
			/** @type {Polygon} */
			const countryPoly = []
			const line = borders[country]
			for (let i = 0; i < line.x.length; i++) {
				if (!isNumeric(line.x[i])) continue
				countryPoly.push({ x: line.x[i], z: line.z[i] })
			}

			return countryPoly
		})

		data[3] = {
			'name': 'Country Borders',
			'id': 'borders',
			'order': 999,
			'hide': true,
			'control': true,
			'markers': [makePolyline(points)]
		}
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
 * @returns {ParsedMarkerInfo}
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

	// Create clickable resident lists
	const isArchiveMode = mapMode == 'archive'
	const residentList = isArchiveMode ? residents :
		residents.split(', ').map(resident => htmlCode.residentClickable.replaceAll('{player}', resident)).join(', ')
	const councillorList = isArchiveMode ? councillors :
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
		.replace(town, fixedTownName)
		.replace(nation, fixedNationName)
		.replaceAll('<b>false</b>', '<b><span style="color: red">No</span></b>') // 'False' flag
		.replaceAll('<b>true</b>', '<b><span style="color: green">Yes</span></b>') // 'True' flag
	
	if (!isArchiveMode) {
		marker.popup = marker.popup
		.replace(/Mayor: <b>(.*)<\/b>/, `Mayor: <b>${htmlCode.residentClickable.replaceAll('{player}', mayor)}</b>`) // Lookup mayor
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

	if (mapMode == 'alliances' || mapMode == 'meganations') {
		// Add 'Part of' label
		const nationAlliances = getNationAlliances(nation, mapMode)
		if (nationAlliances.length > 0) {
			const allianceList = nationAlliances.map(alliance => alliance.name).join(', ')
			const partOfLabel = htmlCode.partOfLabel.replace('{allianceList}', allianceList)
			marker.popup = marker.popup.replace('</span>\n', '</span></br>' + partOfLabel)
		}
	}

	return {
		townName: fixedTownName, 
		nationName: fixedNationName,
		residentNum, residentList: residents.split(', '), 
		isCapital, area, mayor
	}
}

/**
 * Modifies a town description of a Dynmap archive marker.
 * @param {DynmapMarker} marker 
 * @param {number} curArchiveDate - Date as a number in the format YYYYDDMM
 * @returns {ParsedMarkerInfo}
 */
function modifyDynmapDescription(marker, curArchiveDate) {
	const residents = marker.popup.match(/Members <span style="font-weight:bold">(.*)<\/span><br \/>Flags/)?.[1]
	const residentList = residents?.split(', ') ?? []
	const residentNum = residentList.length
	const isCapital = marker.popup.match(/capital: true/) != null
	const area = calcPolygonArea(marker.points)

	// Modify description
	if (isCapital) marker.popup = marker.popup.replace('120%">', '120%">★ ') // Prepend star indicating a capital
	if (curArchiveDate < 20220906) {
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

	return {
		...parseTownNation(marker.popup), // aka "desc" for dynmap
		residentList, residentNum, 
		isCapital, area,
	}
}

function parseTownNation(html) {
	// strip all HTML tags and leading star
	let clean = html.replace(/<[^>]+>/g, '').trim()
	clean = clean.replace(/^★\s*/, '')

	const match = clean.match(/^(.+?)\s*\((.+?)\)/)

	const townName = match?.[1]?.trim() || null
	const nationName = match?.[2]?.trim() || null

	return { townName, nationName }
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
 * @param {Marker} marker
 * @param {ParsedMarkerInfo} townInfo
 * @param {MapMode} mapMode - The currently selected map mode.
 */
function colorTown(marker, townInfo, mapMode) {
	const mayor = marker.popup.match(/Mayor: <b>(.*)<\/b>/)?.[1]
	const isRuin = !!mayor?.match(/NPC[0-9]+/)
	if (isRuin) return colorMarker(marker, '#000000', '#000000')

	const { nationName } = townInfo

	if (mapMode == 'meganations') {
		const isDefaultCol = marker.color == DEFAULT_BLUE && marker.fillColor == DEFAULT_BLUE
		marker.color = isDefaultCol ? '#363636' : DEFAULT_GREEN
		marker.fillColor = isDefaultCol ? hashCode(nationName) : marker.fillColor
	}
	else if (mapMode == 'overclaim') {
		const nation = nationName ? cachedApiNations.get(nationName.toLowerCase()) : null
		const overclaimInfo = !!nation
			? checkOverclaimed(townInfo.area, townInfo.residentNum, nation.stats.numResidents)
			: checkOverclaimedNationless(townInfo.area, townInfo.residentNum)

		const colour = overclaimInfo.isOverclaimed ? '#ff0000' : '#00ff00'
		colorMarker(marker, colour, colour, overclaimInfo.isOverclaimed ? 2 : 0.5)
	}
	else colorMarker(marker, '#000000', '#000000', 1) // 'alliances' mode

	// Properties for alliances and meganations
	const nationAlliances = getNationAlliances(nationName, mapMode)
	if (nationAlliances.length == 0) return
	
	const { colours } = nationAlliances[0] // First alliance in related alliances
	const newWeight = nationAlliances.length > 1 ? 1.5 : 0.75 // Use bolder weight if many related alliances
	return colorMarker(marker, colours.fill, colours.outline, newWeight)
}

/**
 * @param {Marker} marker
 * @param {string} nationName
 * @param {Map<string|null, string|null>} claimsCustomizerInfo
 */
function colorTownNationClaims(marker, nationName, claimsCustomizerInfo) {
	//const strippedName = nationName?.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
	
	const nationColorInput = claimsCustomizerInfo.get(nationName?.toLowerCase())
	if (!nationColorInput) {
		const showExcluded = localStorage['emcdynmapplus-nation-claims-show-excluded'] == 'true' ? true : false
		if (!showExcluded) marker.fillOpacity = marker.opacity = 0 // Make town invisible if not part of a nation in claims customizer.
	
		return colorMarker(marker, '#000000', '#000000', 1)
	}
	
	const useOpaqueColors = localStorage['emcdynmapplus-nation-claims-opaque-colors'] == 'true' ? true : false
	if (useOpaqueColors) marker.fillOpacity = marker.opacity = 1 // 100% opacity similar to manual player drawn claim maps

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
	if (!leafletTL) return showAlert('Error selecting element required to show player lookup.')

	const loading = addElement(leafletTL, htmlCode.playerLookupLoading, '#player-lookup-loading')
	const players = await postJSON(`${OAPI_BASE}/${CURRENT_MAP}/players`, { query: [playerName] })

	loading.remove()

	if (players == null) return showAlert('Service is currently unavailable, please try later.')
	if (players.length < 1) return showAlert('Error looking up this player. They have possibly opted-out.')

	const lookup = addElement(leafletTL, htmlCode.playerLookup, '#player-lookup')

	// Populate with placeholders
	lookup.insertAdjacentHTML('beforeend', '<span class="close-container">X</span>')
	lookup.insertAdjacentHTML('beforeend', '{show-online-status}<br>')
	lookup.insertAdjacentHTML('beforeend', '<img id="player-lookup-avatar"/>')
	lookup.insertAdjacentHTML('beforeend', '<center><b id="player-lookup-name">{player}</b>{about}</center>')
	lookup.insertAdjacentHTML('beforeend', '<hr>{town}{nation}')
	lookup.insertAdjacentHTML('beforeend', 'Rank: <b>{rank}</b><br>')
	lookup.insertAdjacentHTML('beforeend', 'Balance: <b>{balance} gold</b><br>')
	lookup.insertAdjacentHTML('beforeend', '{last-online}')

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
		.replace('{player}', player.name || playerName)
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

// Black
const DEFAULT_ALLIANCE_COLOURS = { fill: '#000000', outline: '#000000' }

/**
 * @param {AllianceColours} colours  
 */
function parseColours(colours) {
	if (!colours) return DEFAULT_ALLIANCE_COLOURS
	colours.fill = "#" + colours.fill.replaceAll("#", "")
	colours.outline = "#" + colours.outline.replaceAll("#", "")
	return colours
}

/**
 * @returns {Promise<Array<CachedAlliance>>}
 */
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

	// Build map of parentAlliance (identifier) -> child alliances for O(1) lookup
	const childrenByParent = new Map()
	for (const a of alliances) {
		if (!a.parentAlliance) continue

		const arr = childrenByParent.get(a.parentAlliance) || []
		arr.push(a)
		childrenByParent.set(a.parentAlliance, arr)
	}

	const allianceData = []
	for (const alliance of alliances) {
		const allianceType = alliance.type?.toLowerCase() || 'mega'
		//if (alliance.parentAlliance) continue // this is a child alliance, skip it

		const children = childrenByParent.get(alliance.identifier) || []
		allianceData.push({
			name: alliance.label || alliance.identifier,
			modeType: allianceType == 'mega' ? 'meganations' : 'alliances',
			ownNations: alliance.ownNations || [],
			puppetNations: children.flatMap(a => a.ownNations || []),
			colours: parseColours(alliance.optional.colours)
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
		if (alliance.modeType != mapMode) continue

		const nations = [...alliance.ownNations, ...alliance.puppetNations]
		if (!nations.includes(nationName)) continue

		nationAlliances.push({ name: alliance.name, colours: alliance.colours })
	}

	return nationAlliances
}

const getArchiveURL = (date, markersURL) => `https://web.archive.org/web/${date}id_/${markersURL}`

/**
 * @param {Object} markers - The old markers response JSON data
 */
async function getArchive(data) {
	const loadingMessage = addElement(document.body, htmlCode.alertMsg.replace('{message}', 'Loading archive, please wait...'), '.message')
	const date = archiveDate()
	
	// markers.json URL changed over time
	const markersURL = 
		date < 20240701 ? "https://earthmc.net/map/aurora/standalone/MySQL_markers.php?marker=_markers_/marker_earth.json" :
		date < 20230212 ? "https://earthmc.net/map/aurora/tiles/_markers_/marker_earth.json" :
		"https://map.earthmc.net/tiles/minecraft_overworld/markers.json" // latest

	const archive = await fetchJSON(PROXY_URL + getArchiveURL(date, markersURL))
	if (!archive) return showAlert('Archive service is currently unavailable, please try later.')

	let actualArchiveDate // Structure of markers.json changed at some point
	if (date < 20240701) {
		data[0].markers = convertOldMarkersStructure(archive.sets['townyPlugin.markerset'])
		actualArchiveDate = archive.timestamp
	} else {
		data = archive
		actualArchiveDate = archive[0].timestamp
	}

	actualArchiveDate = new Date(parseInt(actualArchiveDate)).toLocaleDateString()
	document.querySelector('#current-map-mode-label').textContent += ` (${actualArchiveDate})`
	loadingMessage.remove()
	if (actualArchiveDate.replaceAll('-', '') != date) {
		showAlert(`The closest archive to your prompt comes from ${actualArchiveDate}.`)
	}

	return data
}

/**
 * @param {Object} markerset - The towny markerset of the old markers response JSON data
 */
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

const CHUNKS_PER_RES = 12

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
 * @param {number} numNationResidents 
 */
function checkOverclaimed(claimedChunks, numResidents, numNationResidents) {
    const resLimit = numResidents * CHUNKS_PER_RES
	
	const bonus = auroraNationBonus(numNationResidents)
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
function auroraNationBonus(numNationResidents) {
	return numNationResidents >= 200 ? 100
		: numNationResidents >= 120 ? 80
		: numNationResidents >= 80 ? 60
		: numNationResidents >= 60 ? 50
		: numNationResidents >= 40 ? 30
		: numNationResidents >= 20 ? 10 : 0
} 