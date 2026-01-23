// ==UserScript==
// @name         EarthMC Dynmap+
// @version      1.16
// @description  Extension to enrich the EarthMC map experience
// @author       3meraldK
// @match        https://map.earthmc.net/*
// @iconURL      https://raw.githubusercontent.com/3meraldK/earthmc-dynmap/main/icon.png
// ==/UserScript==

// All files consolidated

const htmlCode = {
	playerLookup: '<div class="leaflet-control-layers leaflet-control left-container" id="player-lookup"></div>',
	partOfLabel: '<span id="part-of-label">Part of <b>{allianceList}</b></span>',
	residentClickable: '<span class="resident-clickable" onclick="lookupPlayerFunc(\'{player}\')">{player}</span>',
	residentList: '<span class="resident-list">\t{list}</span>',
	scrollableResidentList: '<div class="resident-list" id="scrollable-list">\t{list}</div>',
	playerLookupLoading: '<div class="leaflet-control-layers leaflet-control left-container" id="player-lookup-loading">Loading...</button>',
	alertBox: '<div id="alert"><p id="alert-message">{message}</p><br><button id="alert-close">OK</button></div>',
	message: '<div id="alert" class="message"><p id="alert-message">{message}</p></div>',
	buttons: {
		locate: '<button class="sidebar-button" id="locate-button">Locate</button>',
		searchArchive: '<button class="sidebar-button" id="archive-button">Search archive</button>',
		options: '<button class="sidebar-button" id="options-button">Options</button>',
		switchMapMode: '<button class="sidebar-input" id="switch-map-mode">Switch map mode</button>'
	},
	options: {
		menu: '<div id="options-menu"></div>',
		option: '<div class="option"></div>',
		label: '<label for="{option}">{optionName}</label>',
		checkbox: '<input id="{option}" type="checkbox" name="{option}">',
	},
	sidebar: '<div class="leaflet-control-layers leaflet-control" id="sidebar"></div>',
	sidebarOption: '<div class="sidebar-option"></div>',
	locateInput: '<input class="sidebar-input" id="locate-input" placeholder="London">',
	locateSelect: '<select class="sidebar-button" id="locate-select"><option>Town</option><option>Nation</option><option>Resident</option></select>',
	archiveInput: `<input class="sidebar-input" id="archive-input" type="date" min="2022-05-01" max="${new Date().toLocaleDateString('en-ca')}">`,
	currentMapModeLabel: '<div class="sidebar-option" id="current-map-mode-label">Current map mode: {currentMapMode}</div>',
	// For userscript
	updateNotification: '<div class="leaflet-control-layers leaflet-control left-container" id="update-notification">{text}<br><span class="close-container">X</span></div>'
}

const currentMapMode = () => localStorage['emcdynmapplus-mapmode'] ?? 'meganations'

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
 * @param {HTMLElement} parent
 * @param {HTMLElement} element
 * @param {string} selector
 * @param {boolean} all
 */
function addElement(parent, element, selector, all = false) {
	parent.insertAdjacentHTML('beforeend', element)
	return (!all) ? parent.querySelector(selector) : parent.querySelectorAll(selector)
}

/**
 * @param {string} selector
 * @returns {Promise<Element | null>}
 */
const waitForElement = (selector) => new Promise(resolve => {
    const selected = document.querySelector(selector)
    if (selected) return resolve(selected)

    const observer = new MutationObserver(() => {
        const selected = document.querySelector(selector)
        if (selected) {
            resolve(selected)
            observer.disconnect()
        }
    })
    observer.observe(document.body, { childList: true, subtree: true })
})

async function fetchJSON(url, options = null) {
	const response = await fetch(url, options)
	if (response.status == 404) return false
	if (response.ok) return response.json()
	
	return null
}

const OAPI_BASE = 'https://api.earthmc.net/v3/aurora'
const CAPI_BASE = 'https://emcstats.bot.nu'
const CURRENT_MAP = 'aurora'

init()
appendStyle()

function addMainMenu(parent) {
	const sidebar = addElement(parent, htmlCode.sidebar, '#sidebar')

	addLocateMenu(sidebar)

	// Search archive
	const archiveContainer = addElement(sidebar, htmlCode.sidebarOption, '.sidebar-option', true)[2]
	const archiveButton = addElement(archiveContainer, htmlCode.buttons.searchArchive, '#archive-button')
	const archiveInput = addElement(archiveContainer, htmlCode.archiveInput, '#archive-input')
	archiveButton.addEventListener('click', () => searchArchive(archiveInput.value))
	archiveInput.addEventListener('keyup', event => {
		if (event.key == 'Enter') searchArchive(archiveInput.value)
	})

	// Switch map mode button
	const switchMapModeButton = addElement(sidebar, htmlCode.buttons.switchMapMode + '<br>', '#switch-map-mode')
	switchMapModeButton.addEventListener('click', () => switchMapMode())

	addOptions(sidebar)

	// Current map mode label
	const currentMapModeLabel = addElement(sidebar, htmlCode.currentMapModeLabel, '#current-map-mode-label')
	currentMapModeLabel.textContent = currentMapModeLabel.textContent.replace('{currentMapMode}', currentMapMode())
}

function decreaseBrightness(isChecked) {
	const element = document.querySelector('.leaflet-tile-pane')
	localStorage['emcdynmapplus-darkened'] = isChecked
	element.style.filter = (isChecked) ? 'brightness(50%)' : ''
}

function switchMapMode() {
	const nextMapMode = {
		meganations: 'alliances',
		alliances: 'default',
		default: 'meganations'
	}
	localStorage['emcdynmapplus-mapmode'] = nextMapMode[currentMapMode()] ?? 'meganations'
	location.reload()
}

function init() {
	localStorage['emcdynmapplus-mapmode'] = localStorage['emcdynmapplus-mapmode'] ?? 'meganations'
	localStorage['emcdynmapplus-darkened'] = localStorage['emcdynmapplus-darkened'] ?? true

	waitForElement('.leaflet-tile-pane').then(() => {
		if (localStorage['emcdynmapplus-darkened'] == 'true') decreaseBrightness(true)
	})
	waitForElement('.leaflet-top.leaflet-left').then(element => {
		addMainMenu(element)
		checkForUpdate(element) // For userscript

		// Prevents panning the map when on this element by
        // stopping the mouse event from propogating to Leaflet.
        el.addEventListener('mousedown', e => e.stopPropagation())

        // blocks the map (Leaflet) from zooming when 
        // double clicking in the sidebar main menu
        el.addEventListener('dblclick', e => {
            e.stopPropagation()
            e.preventDefault()
        })
	})

	if (localStorage['emcdynmapplus-darkmode'] == 'true') loadDarkMode()
	
	// Fix nameplates appearing over popups
	waitForElement('.leaflet-nameplate-pane').then(element => element.style = '')
}

function loadDarkMode() {
	document.head.insertAdjacentHTML('beforeend',
		`<style id="dark-mode">
		.leaflet-control, #alert, .sidebar-input,
		.sidebar-button, .leaflet-bar > a, .leaflet-tooltip-top,
		.leaflet-popup-content-wrapper, .leaflet-popup-tip,
		.leaflet-bar > a.leaflet-disabled {
			background: #111;
			color: #bbb;
			box-shadow: 0 0 2px 1px #bbb;
		}
		div.leaflet-control-layers.link img {
			filter: invert(1);
		}</style>`
	)
}

function toggleDarkMode(isChecked) {
	if (isChecked) {
		localStorage['emcdynmapplus-darkmode'] = true
		loadDarkMode()
	}
	else {
		localStorage['emcdynmapplus-darkmode'] = false
		document.querySelector('#dark-mode').remove()
		waitForElement('.leaflet-map-pane').then(element => element.style.filter = '')
	}
}

function locate(selectValue, inputValue) {
	switch (selectValue) {
		case 'Town': locateTown(inputValue); break
		case 'Nation': locateNation(inputValue); break
		case 'Resident': locateResident(inputValue); break
	}
}

async function checkForUpdate(parent) {
	const localVersion = GM_info.script.version
	const manifest = await fetchJSON('https://raw.githubusercontent.com/3meraldK/earthmc-dynmap/main/manifest.json')
	if (!manifest) return console.log('EarthMC Dynmap+ could not check for update.')
	const latestVersion = manifest.version
	if (!latestVersion || latestVersion == localVersion) return
	parent.insertAdjacentHTML('beforeend', htmlCode.updateNotification)
	const updateNotification = parent.querySelector('#update-notification')
	const repoURL = 'https://github.com/3meraldK/earthmc-dynmap/releases/latest'
	const text = `EarthMC Dynmap+ update from ${localVersion} to ${latestVersion} is available. <a id="update-download-link" target="_blank" href="${repoURL}">Click here to download!</a>`
	updateNotification.innerHTML = updateNotification.innerHTML.replace('{text}', text)
	updateNotification.querySelector('.close-container').addEventListener('click', event => { event.target.parentElement.remove() })
}

function addOptions(sidebar) {
	const optionsButton = addElement(sidebar, htmlCode.buttons.options, '#options-button')
	const optionsMenu = addElement(sidebar, htmlCode.options.menu, '#options-menu')
	optionsMenu.style.display = 'none'
	optionsButton.addEventListener('click', () => {
		optionsMenu.style.display = (optionsMenu.style.display == 'none') ? 'unset' : 'none'
	})

	const checkbox = {
		decreaseBrightness: addOption(0, 'decrease-brightness', 'Decrease brightness', 'darkened'),
		darkMode: addOption(1, 'toggle-darkmode', 'Toggle dark mode', 'darkmode')
	}

	checkbox.decreaseBrightness.addEventListener('change', event => decreaseBrightness(event.target.checked))
	checkbox.darkMode.addEventListener('change', event => toggleDarkMode(event.target.checked))
}

function searchArchive(date) {
	if (date == '') return
	const URLDate = date.replaceAll('-', '')
	localStorage['emcdynmapplus-archive-date'] = URLDate
	localStorage['emcdynmapplus-mapmode'] = 'archive'
	location.reload()
}

function addLocateMenu(sidebar) {
	const locateMenu = addElement(sidebar, htmlCode.sidebarOption, '.sidebar-option', true)[0]
	locateMenu.id = 'locate-menu'
	const locateButton = addElement(locateMenu, htmlCode.buttons.locate, '#locate-button')
	const locateSubmenu = addElement(locateMenu, htmlCode.sidebarOption, '.sidebar-option')
	const locateSelect = addElement(locateSubmenu, htmlCode.locateSelect, '#locate-select')
	const locateInput = addElement(locateSubmenu, htmlCode.locateInput, '#locate-input')
	locateSelect.addEventListener('change', () => {
		switch (locateSelect.value) {
			case 'Town': locateInput.placeholder = 'London'; break
			case 'Nation': locateInput.placeholder = 'Germany'; break
			case 'Resident': locateInput.placeholder = 'Notch'; break
		}
	})
	locateInput.addEventListener('keyup', event => {
		if (event.key != 'Enter') return
		locate(locateSelect.value, locateInput.value)
	})
	locateButton.addEventListener('click', () => {
		locate(locateSelect.value, locateInput.value)
	})
}

function addOption(index, optionId, optionName, variable) {
	const optionsMenu = document.querySelector('#options-menu')
	const option = addElement(optionsMenu, htmlCode.options.option, '.option', true)[index]
	option.insertAdjacentHTML('beforeend', htmlCode.options.label
		.replace('{option}', optionId)
		.replace('{optionName}', optionName))
	const checkbox = addElement(option, htmlCode.options.checkbox.replace('{option}', optionId), '#' + optionId)
	checkbox.checked = (localStorage['emcdynmapplus-' + variable] == 'true')
	return checkbox
}

async function locateTown(town) {
	town = town.trim().toLowerCase()
	if (town == '') return

	const coords = await getTownSpawn(town)
	if (coords == false) return showAlert('Searched town has not been found.')
	if (coords == null) return showAlert('Service is currently unavailable, please try later.')

	location.href = `https://map.earthmc.net/?zoom=4&x=${coords.x}&z=${coords.z}`
}

async function locateNation(nation) {
	nation = nation.trim().toLowerCase()
	if (nation == '') return

	const query = { query: [nation], template: { capital: true } }
	const data = await fetchJSON(`${OAPI_BASE}/nations`, {method: 'POST', body: JSON.stringify(query)})
	if (data == false) return showAlert('Searched nation has not been found.')
	if (data == null) return showAlert('Service is currently unavailable, please try later.')

	const capital = data[0].capital.name
	const coords = await getTownSpawn(capital)
	if (coords == false) return showAlert('Unexpected error occurred while searching for nation, please try later.')
	if (coords == null) return showAlert('Service is currently unavailable, please try later.')
	location.href = `https://map.earthmc.net/?zoom=4&x=${coords.x}&z=${coords.z}`
}

async function locateResident(resident) {
	resident = resident.trim().toLowerCase()
	if (resident == '') return

	const query = { query: [resident], template: { town: true } }
	const data = await fetchJSON(`${OAPI_BASE}/players`, {method: 'POST', body: JSON.stringify(query)})
	if (data == false) return showAlert('Searched resident has not been found.')
	if (data == null) return showAlert('Service is currently unavailable, please try later.')

	const town = data[0].town.name
	if (!town) return showAlert('The searched resident is townless.')
	const coords = await getTownSpawn(town)
	if (coords == false) return showAlert('Unexpected error occurred while searching for resident, please try later.')
	if (coords == null) return showAlert('Service is currently unavailable, please try later.')
	location.href = `https://map.earthmc.net/?zoom=4&x=${coords.x}&z=${coords.z}`
}

async function getTownSpawn(town) {
	const query = { query: [town], template: { coordinates: true } }
	const data = await fetchJSON(`${OAPI_BASE}/towns`, {method: 'POST', body: JSON.stringify(query)})
	if (data == false || data == undefined) return false
	if (data == null) return null
	return { x: Math.round(data[0].coordinates.spawn.x), z: Math.round(data[0].coordinates.spawn.z) }
}

// main.js

const { fetch: originalFetch } = unsafeWindow
// Make this function work in userscript
unsafeWindow.lookupPlayerFunc = lookupPlayer
const PROXY_URL = 'https://api.codetabs.com/v1/proxy/?quest='

let alliances = null
if (currentMapMode() != 'default' && currentMapMode() != 'archive') {
	getAlliances().then(result => alliances = result)
}

const archiveDate = parseInt(localStorage['emcdynmapplus-archive-date'])

// Add clickable player nameplates
waitForElement('.leaflet-nameplate-pane').then(element => {
	element.addEventListener('click', event => {
		const username = event.target.textContent || event.target.parentElement.parentElement.textContent
		if (username.length > 0) lookupPlayer(username, false)
	})
})

function modifySettings(data) {
	data['player_tracker'].nameplates['show_heads'] = true
	data['player_tracker'].nameplates['heads_url'] = 'https://mc-heads.net/avatar/{uuid}/16'
	data.zoom.def = 0
	// Set camera on Europe
	data.spawn.x = 2000
	data.spawn.z = -10000
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

// Shoelace formula
function getArea(vertices) {
	const n = vertices.length
	let area = 0

	// Vertices need rounding to 16 because data has imprecise coordinates
	for (let i = 0; i < n; i++) {
		const j = (i + 1) % n
		area += roundTo16(vertices[i].x) * roundTo16(vertices[j].z)
		area -= roundTo16(vertices[j].x) * roundTo16(vertices[i].z)
	}

	return (Math.abs(area) / 2) / (16 * 16)
}

/**
 * Credit: James Halliday (substack)
 * @param {{x: number, z: number}} vertex 
 * @param {Array<{x: number, z: number}>} polygon
 */
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

/**
 * Modify town descriptions for Dynmap archives
 * @param {{tooltip: string, popup: string}} marker 
 */
function modifyOldDescription(marker) {
	const residents = marker.popup.match(/Members <span style="font-weight:bold">(.*)<\/span><br \/>Flags/)?.[1]
	const residentNum = residents?.split(', ')?.length || 0
	const isCapital = marker.popup.match(/capital: true/) != null
	const area = getArea(marker.points)

	// Modify description
	if (isCapital) marker.popup = marker.popup.replace('120%">', '120%">★ ')
	if (archiveDate < 20220906) {
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
		.replace(town, names.town)
		.replace(nation, names.nation)
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
	const town = marker.tooltip.match(/<b>(.*)<\/b>/)[1]
	const nation = marker.tooltip.match(/\(\b(?:Member|Capital)\b of (.*)\)\n/)?.[1]
	const mayor = marker.popup.match(/Mayor: <b>(.*)<\/b>/)?.[1]
	const isCapital = marker.tooltip.match(/\(Capital of (.*)\)/) != null

	const residents = marker.popup.match(/<\/summary>\n    \t(.*)\n   \t<\/details>/)?.[1]
	const residentNum = residents.split(', ').length

	const councillors = marker.popup.match(/Councillors: <b>(.*)<\/b>/)?.[1]
		.split(', ').filter(councillor => councillor != 'None')

	// Fix bug with names wrapped in angle brackets
	const names = {
		town: town.replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
		nation: nation?.replaceAll('<', '&lt;').replaceAll('>', '&gt;') ?? nation
	}

	// Calculate town's area
	let area = 0
	const iteratedRegions = []
	if (marker.type == 'polygon') {
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
		.replaceAll('<b>false</b>', '<b><span style="color: red">No</span></b>') // 'False' flag
		.replaceAll('<b>true</b>', '<b><span style="color: green">Yes</span></b>') // 'True' flag
	
	if (currentMapMode() != 'archive') {
		marker.popup = marker.popup
			.replace(/Mayor: <b>(.*)<\/b>/, `Mayor: <b>${htmlCode.residentClickable.replaceAll('{player}', mayor)}</b>`) // Lookup mayor
			.replace(/Councillors: <b>(.*)<\/b>/, `Councillors: <b>${councillorList}</b>`) // Lookup councillors
	}

	if (isCapital) {
		// Add capital star
		marker.popup = marker.popup.replace('<span style="font-size:120%;">', '<span style="font-size: 120%">★ ')
	}

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

/**
 * @param {object} markers - The old markers response JSON data
 */
function convertOldMarkersStructure(markers) {
	return Object.entries(markers.areas).flatMap(([key, v]) => {
		if (key.includes('_Shop')) return []
		return {
			fillColor: v.fillcolor,
			color: v.color,
			popup: v.desc ?? `<div><b>${v.label}</b></div>`,
			weight: v.weight,
			opacity: v.opacity,
			type: 'polygon',
			points: v.x.map((x, i) => ({ x, z: v.z[i] }))
		}
	})
}

/**
 * Gets all alliances the input nation exists within / is related to.
 * @param {string} nation 
 * @returns {Array<{name: string, colours: { fill: string, outline: string }}>}
 */
function getNationAlliances(nation) {
	if (alliances == null) return []

	const nationAlliances = []
	for (const alliance of alliances) {
		if (!alliance.nations.includes(nation)) continue
		if (alliance.modeType != currentMapMode()) continue
		nationAlliances.push({name: alliance.name, colours: alliance.colours})
	}

	return nationAlliances
}

function colorTowns(marker) {
	const nation = marker.tooltip.match(/\(\b(?:Member|Capital)\b of (.*)\)\n/)?.[1]
	const nationHasDefaultColor = (marker.color == '#3fb4ff' && marker.fillColor == '#3fb4ff') // Default blue
	const mayor = marker.popup.match(/Mayor: <b>(.*)<\/b>/)?.[1]
	const isRuin = (mayor.match(/NPC[0-9]+/) != null)
	//const isNationless = (nation == null)

	// Universal properties for the map modes
	if (currentMapMode() == 'alliances') {
		marker.color = '#000000' // Black
		marker.fillColor = '#000000'
		marker.weight = 0.5
	} else {
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
			{ "x": x, "z": -16640 },
			{ "x": x, "z": +16512 },
			{ "x": x, "z": -16640 }
		])
	}
	for (let z = -16640; z <= 16512; z += 16) {
		chunkLines.push([
			{ "x": -33280, "z": z },
			{ "x": +33088, "z": z },
			{ "x": -33280, "z": z }
		])
	}

	data[2] = {
		"hide": true,
		"name": "Chunks",
		"control": true,
		"id": "chunks",
		"markers": [{
			"weight": 0.33,
			"color": "#000000",
			"type": "polyline",
			"points": chunkLines
		}]
	}
	return data
}

async function main(data) {
	const mapMode = currentMapMode()
	if (mapMode == 'archive') {
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

		marker = (mapMode != 'archive' || archiveDate >= 20240701)
			? modifyDescription(marker) 
			: modifyOldDescription(marker)

		if (marker.type != 'polygon') continue

		// Universal properties
		marker.opacity = 1
		marker.fillOpacity = 0.33
		marker.weight = 1.5

		if (mapMode == 'default' || mapMode == 'archive') continue

		marker = colorTowns(marker)
	}
	return data
}

/**
 * @param {Array<any>} data - The markers response JSON data.
 */
async function addCountryLayer(data) {
	if (!localStorage['emcdynmapplus-borders']) {
		const loadingMessage = addElement(document.body, htmlCode.alertMsg.replace('{message}', 'Downloading country borders...'), '.message')
		const markersURL = 'https://web.archive.org/web/2024id_/https://earthmc.net/map/aurora/standalone/MySQL_markers.php?marker=_markers_/marker_earth.json'
		const markersJson = await fetchJSON(PROXY_URL + markersURL)
			.catch(e => { console.error(e); return null } )	
			.finally(loadingMessage.remove())

		if (!markersJson) {
			showAlert('Could not download optional country borders layer, you could try again later.')
			return data
		}
		localStorage['emcdynmapplus-borders'] = JSON.stringify(markersJson.sets['borders.Country Borders'].lines)
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

async function lookupPlayer(playerName, showOnlineStatus = true) {
	if (document.querySelector('#player-lookup') != null) document.querySelector('#player-lookup').remove()
	if (document.querySelector('#player-lookup-loading') != null) document.querySelector('#player-lookup-loading').remove()
	const loading = addElement(document.querySelector('.leaflet-top.leaflet-left'), htmlCode.playerLookupLoading, '#player-lookup-loading')

	const query = { query: [playerName] }
	const players = await fetchJSON('https://api.earthmc.net/v3/aurora/players', { method: 'POST', body: JSON.stringify(query) })
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
 * @param {{fill: string, outline: string}} colours  
 */
function parseColours(colours) {
	if (!colours) return DEFAULT_ALLIANCE_COLOURS
	colours.fill = "#" + colours.fill.replaceAll("#", "")
	colours.outline = "#" + colours.outline.replaceAll("#", "")
	return colours
}

/**
 * @returns {Array<{name: string, modeType: string, nations: Array<string>, colours: {fill: string, outline: string}}>}
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

	const finalArray = []
	for (const alliance of alliances) {
		const allianceType = alliance.type.toLowerCase() || 'mega'
		if (allianceType == 'sub') continue // TODO: This doesn't exist anymore. Remove or replace with 'org' ?

		finalArray.push({
			name: alliance.label || alliance.identifier,
			modeType: allianceType == 'mega' ? 'meganations' : 'alliances',
			nations: alliance.ownNations,
			colours: parseColours(alliance.optional.colours)
		})
	}

	localStorage['emcdynmapplus-alliances'] = JSON.stringify(finalArray)
	return finalArray
}

async function getArchive(data) {
	const loadingMessage = addElement(document.body, htmlCode.message.replace('{message}', 'Loading archive, please wait...'), '.message')

	const archiveWebsite = `https://web.archive.org/web/${archiveDate}id_/`
	// markers.json URL changed over time
	let markersURL = 'https://map.earthmc.net/tiles/minecraft_overworld/markers.json'
	if (archiveDate < 20230212) {
		markersURL = 'https://earthmc.net/map/aurora/tiles/_markers_/marker_earth.json'
	} else if (archiveDate < 20240701) {
		markersURL = 'https://earthmc.net/map/aurora/standalone/MySQL_markers.php?marker=_markers_/marker_earth.json'
	}
	markersURL = archiveWebsite + markersURL

	const archive = await fetchJSON(PROXY_URL + markersURL)
	if (!archive) return showAlert('Archive service is currently unavailable, please try later.')
	let actualArchiveDate

	// Structure of markers.json changed
	if (archiveDate < 20240701) {
		data[0].markers = convertOldMarkersStructure(archive.sets['townyPlugin.markerset'])
		actualArchiveDate = archive.timestamp
	} else {
		data = archive
		actualArchiveDate = archive[0].timestamp
	}

	actualArchiveDate = new Date(parseInt(actualArchiveDate)).toLocaleDateString('en-ca')
	document.querySelector('#current-map-mode-label').textContent += ` (${actualArchiveDate})`
	loadingMessage.remove()
	if (actualArchiveDate.replaceAll('-', '') != archiveDate) {
		showAlert(`The closest archive to your prompt comes from ${actualArchiveDate}.`)
	}

	return data
}

// Replace the default fetch() with ours to intercept responses
let preventMapUpdate = false
unsafeWindow.fetch = async (...args) => {
	let [url, opts] = args
	let response = await originalFetch(url, opts)

	if (response.url.includes('web.archive.org')) return response
	const isMarkers = response.url.includes('markers.json')
	const isSettings = response.url.includes('minecraft_overworld/settings.json')

	// Modify contents of markers.json and settings.json
	if (isMarkers || isSettings) {
		const modifiedJson = await response.clone().json().then(data => {
			// settings.json
			if (isSettings) return modifySettings(data)

			// markers.json
			if (isMarkers) {
				if (preventMapUpdate == false) {
					preventMapUpdate = true
					return main(data)
				}
				
				return null
			}
		})
	
		return new Response(JSON.stringify(modifiedJson))
	}

	return response
}

// style.css

function appendStyle() {
	const css = `
	.left-container {
		width: 150px;
		text-align: justify;
		font-size: larger;
		padding: 5px;
		box-sizing: border-box;
	}

	.close-container {
		position: relative;
		left: 120px;
		cursor: pointer;
	}

	.close-container:hover {
		background-color: rgba(127, 127, 125, 0.5);
	}

	/* Player lookup */

	#player-lookup {
		text-align: unset;
	}

	#player-lookup-online {
		position: absolute;
		top: 5px;
		left: 5px;
	}

	#player-lookup-avatar {
		margin: 10px auto auto auto;
		display: block;
		width: 32px;
		box-shadow: 0 0 10px 1px black;
	}

	#player-lookup-name {
		line-height: 40px;
	}

	/* Main sidebar */

	.sidebar-option {
		width: 150px;
		display: flex;
	}

	.sidebar-input {
		width: 100%;
	}

	.sidebar-button {
		min-width: 75px;
	}

	#current-map-mode-label {
		font-size: larger;
		padding: 5px;
		box-sizing: border-box;
	}

	#sidebar {
		padding: 3px;
	}

	#locate-menu {
		padding-bottom: 5px;
		display: block;
	}

	#locate-button, #options-button, #options-menu {
		width: 150px;
	}

	.option {
		display: flex;
		justify-content: space-between;
		padding: 2px 0;
	}

	#archive-input {
		width: 70px;
	}

	/* Town popup */

	#scrollable-list {
		overflow: auto;
		max-height: 200px;
	}

	#clamped-board {
		max-width: 400px;
		text-overflow: ellipsis;
		overflow: hidden;
		display: inline-block;
	}

	.resident-list {
		white-space: pre-wrap;
	}

	#part-of-label {
		font-size: 85%;
	}

	.resident-clickable:hover {
		background-color: rgba(127, 127, 125, 0.5);
		cursor: pointer;
	}

	/* Alert */

	#alert {
		position: absolute;
		width: 300px;
		font-family: 'Arial';
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 1000;
		background-color: white;
		color: black;
		font-size: large;
		box-sizing: border-box;
		padding: 8px;
		text-align: center;
	}

	#alert-message {
		margin-block: 0;
		text-align: justify;
	}

	/* Clickable nameplates */

	.leaflet-tooltip {
		pointer-events: unset !important;
	}

	.leaflet-tooltip:hover {
		background-color: rgba(127, 127, 127, 0.5);
		cursor: pointer;
	}

	#player-lookup-loading {
		width: auto;
	}

	/* Update notification - for userscript */

	#update-download-link {
		font-weight: bold;
		text-decoration: none;
	}
	`

	const head = document.head || document.getElementsByTagName('head')[0]
	const style = document.createElement('style')
	head.appendChild(style)
	style.appendChild(document.createTextNode(css))
}