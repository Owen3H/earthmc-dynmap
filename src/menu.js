/** ANY CODE RELATING TO THE MAIN ONSCREEN EXTENSION MENU GOES HERE */
//console.log('emcdynmapplus: loaded menu')

// TODO: Use Custom Element Registry and convert the main menu into one.

/** @param {HTMLElement} parent - The "leaflet-top leaflet-left" element. */
function addMainMenu(parent) {
	const existingSidebar = parent.querySelector('#sidebar')
	if (existingSidebar) return existingSidebar

	const sidebar = addElement(parent, createElement('div', {
		id: 'sidebar',
		className: 'leaflet-control-layers leaflet-control',
	}))
	addLocateMenu(sidebar) // Locator button and input box

	//#region Archive search and date input
	const archiveContainer = addElement(sidebar, createElement('div', { className: 'sidebar-option' }))
	const archiveButton = addElement(archiveContainer, createElement('button', {
		id: 'archive-button',
		className: 'sidebar-button',
		text: 'Search Archive',
	}))
	const archiveInput = addElement(archiveContainer, createElement('input', {
		id: 'archive-input',
		className: 'sidebar-input',
		type: 'date',
		attrs: {
			min: ARCHIVE_DATE.MIN,
			max: ARCHIVE_DATE.MAX,
		},
	}))
	
	archiveButton.addEventListener('click', _ => searchArchive(archiveInput.value))

	// TODO: Typing in a bogus date will cause infinite "Loading archive..."
	archiveInput.addEventListener('keyup', e => { if (e.key == 'Enter') searchArchive(archiveInput.value) })
	archiveInput.addEventListener('change', _ => {
		const URLDate = archiveInput.value.replaceAll('-', '')
		localStorage['emcdynmapplus-archive-date'] = URLDate
	})
	//#endregion

	const curMapMode = currentMapMode()

	// Switch map mode button
	const switchMapModeButton = addElement(sidebar, createElement('button', {
		id: 'switch-map-mode',
		className: 'sidebar-button',
		text: 'Switch Map Mode',
	}))
	switchMapModeButton.addEventListener('click', _ => switchMapMode(curMapMode))

	// Options button and checkboxes
	addOptions(sidebar, curMapMode)

	// Current map mode label
	addElement(sidebar, createElement('div', {
		id: 'current-map-mode-label',
		className: 'sidebar-option',
		text: `Map Mode: ${curMapMode}`,
	}))

	return sidebar
}

/** 
 * @param {HTMLElement} sidebar 
 * @param {MapMode} curMapMode 
*/
function addOptions(sidebar, curMapMode) {
	const optionsButton = addElement(sidebar, createElement('button', {
		id: 'options-button',
		className: 'sidebar-button',
		text: 'Options',
	}))
	const optionsMenu = addElement(sidebar, createElement('div', { id: 'options-menu' }))
	optionsMenu.style.display = 'none'
	optionsButton.addEventListener('click', _ => {
		optionsMenu.style.display = (optionsMenu.style.display == 'none') ? 'grid' : 'none'
	})

	let i = 0
	const checkboxes = {
		normalizeScroll: addCheckboxOption(optionsMenu, i++, 'toggle-normalize-scroll', 'Normalize scroll inputs', 'normalize-scroll'),
		decreaseBrightness: addCheckboxOption(optionsMenu, i++, 'toggle-darkened', 'Decrease brightness', 'darkened'),
		darkMode: addCheckboxOption(optionsMenu, i++, 'toggle-darkmode', 'Toggle dark mode', 'darkmode'),
		serverInfo: addCheckboxOption(optionsMenu, i++, 'toggle-serverinfo', 'Display server info', 'serverinfo'),
	}

	checkboxes.normalizeScroll.addEventListener('change', e => toggleScrollNormalize(e.target.checked))
	checkboxes.decreaseBrightness.addEventListener('change', e => toggleDarkened(e.target.checked))
	checkboxes.darkMode.addEventListener('change', e => toggleDarkMode(e.target.checked))
	checkboxes.serverInfo.addEventListener('change', e => toggleServerInfo(e.target.checked))
	
	if (curMapMode != 'archive') {
		const showCapitalStars = addCheckboxOption(optionsMenu, i++, 'toggle-capital-stars', 'Show capital stars', 'capital-stars')
		showCapitalStars.addEventListener('change', e => toggleShowCapitalStars(e.target.checked))
	}
}

/**
 * Adds a option which displays a checkbox
 * @param {number} index - The number determining the order of this option in the list 
 * @param {string} optionId - The unique string used to query this option
 * @param {string} optionText - The text to display next to the checkbox
 * @param {string} variable - The variable name in storage used to keep the 'checked' state 
 */
function addCheckboxOption(menu, index, optionId, optionText, variable) {
	const option = addElement(menu, createElement('div', { className: 'option' }))
	addElement(option, createElement('label', {
		htmlFor: optionId,
		text: optionText,
	}))
	
	// Initialize checkbox state
	const checkbox = addElement(option, createElement('input', {
		id: optionId,
		type: 'checkbox',
	}))
	checkbox.checked = (localStorage['emcdynmapplus-' + variable] == 'true')
	return checkbox
}

/** @param {HTMLElement} sidebar */
function addLocateMenu(sidebar) {
	const locateMenu = addElement(sidebar, createElement('div', { id: 'locate-menu' }))
	const locateButton = addElement(locateMenu, createElement('button', {
		id: 'locate-button',
		className: 'sidebar-button',
		text: 'Locate',
	}))
	const locateSubmenu = addElement(locateMenu, createElement('div', { className: 'sidebar-option' }))
	const locateSelect = addElement(locateSubmenu, createElement('select', {
		id: 'locate-select',
		className: 'sidebar-button',
	}, [
		createElement('option', { text: 'Town' }),
		createElement('option', { text: 'Nation' }),
		createElement('option', { text: 'Resident' }),
	]))
	const locateInput = addElement(locateSubmenu, createElement('input', {
		id: 'locate-input',
		className: 'sidebar-input',
		placeholder: 'London',
	}))
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

/**  @param {boolean} boxTicked */
function toggleDarkened(boxTicked) {
	const element = document.querySelector('.leaflet-tile-pane')
	if (!element) return showAlert('Failed to toggle brightness. Cannot apply filter to non-existent tile pane.', 4)

	localStorage['emcdynmapplus-darkened'] = boxTicked

	// Firefox is noticeably slower when panning large filtered layers.
	// Use cheap compositing there and keep the original filter path elsewhere.
	if (isFirefoxBrowser()) {
		element.style.filter = ''
		return toggleFirefoxTileDarkener(boxTicked, element)
	}

	removeFirefoxTileDarkener()
	element.style.filter = boxTicked ? getTilePaneFilter() : ''
}

function getFirefoxTileDarkener() {
	return document.querySelector('#emcdynmapplus-tile-darkener')
}

function ensureFirefoxTileDarkener() {
	let darkener = getFirefoxTileDarkener()
	if (darkener) return darkener

	const mapContainer = document.querySelector('.leaflet-container')
	if (!(mapContainer instanceof HTMLElement)) return null

	darkener = document.createElement('div')
	darkener.id = 'emcdynmapplus-tile-darkener'
	darkener.setAttribute('aria-hidden', 'true')
	mapContainer.appendChild(darkener)
	return darkener
}

function toggleFirefoxTileDarkener(boxTicked, tilePane) {
	const darkener = ensureFirefoxTileDarkener()
	if (!darkener) return showAlert('Failed to toggle brightness overlay. Missing Leaflet container element.', 4)

	darkener.style.display = boxTicked ? 'block' : 'none'
	tilePane.style.opacity = boxTicked ? '0.72' : ''
}

function removeFirefoxTileDarkener() {
	getFirefoxTileDarkener()?.remove()
	const tilePane = document.querySelector('.leaflet-tile-pane')
	if (tilePane instanceof HTMLElement) tilePane.style.opacity = ''
}

/** @param {boolean} boxTicked */
function toggleServerInfo(boxTicked) {
	localStorage['emcdynmapplus-serverinfo'] = boxTicked
	const serverInfoPanel = document.querySelector('#server-info')
	serverInfoPanel?.setAttribute('style', `visibility: ${boxTicked ? 'visible' : 'hidden'}`)

	if (!boxTicked) {
		if (serverInfoScheduler != null) clearTimeout(serverInfoScheduler) // stop future runs
		serverInfoScheduler = null

		return
	}

	if (serverInfoScheduler == null) updateServerInfo(serverInfoPanel) // immediate fetch without spam
}

/** @param {boolean} boxTicked */
function toggleShowCapitalStars(boxTicked) {
	localStorage['emcdynmapplus-capital-stars'] = boxTicked
	const iconContainer = document.querySelector('.leaflet-pane.leaflet-marker-pane')
	iconContainer.setAttribute('style', `visibility: ${boxTicked ? 'visible' : 'hidden'}`)
}

//#region Dark Mode
/** @param {boolean} boxTicked */
function toggleDarkMode(boxTicked) {
	localStorage['emcdynmapplus-darkmode'] = boxTicked
	return boxTicked ? loadDarkMode() : unloadDarkMode()
}

function insertCustomStylesheets() {
	if (!document.head.querySelector('#emcdynmapplus-preconnect-fonts')) {
		addElement(document.head, createElement('link', {
			id: 'emcdynmapplus-preconnect-fonts',
			rel: 'preconnect',
			href: 'https://fonts.googleapis.com',
		}))
	}
	if (!document.head.querySelector('#emcdynmapplus-preconnect-fonts-static')) {
		addElement(document.head, createElement('link', {
			id: 'emcdynmapplus-preconnect-fonts-static',
			rel: 'preconnect',
			href: 'https://fonts.gstatic.com',
			attrs: { crossorigin: '' },
		}))
	}
	if (!document.head.querySelector('#emcdynmapplus-inter-font')) {
		addElement(document.head, createElement('link', {
			id: 'emcdynmapplus-inter-font',
			rel: 'stylesheet',
			href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap',
		}))
	}
	// other stylesheet html links ... 
}

function loadDarkMode() {
	// tell browser not to apply its auto dark mode.
	// this fixes some inverted elements when both are enabled.
	document.documentElement.style.colorScheme = 'dark'
	if (!document.head.querySelector('#dark-mode')) {
		addElement(document.head, createElement('style', {
			id: 'dark-mode',
			text: `
				.leaflet-control, #alert,
				.sidebar-button, .sidebar-input, .leaflet-bar > a,
				.leaflet-tooltip-top, .leaflet-popup-content-wrapper,
				.leaflet-popup-tip, .leaflet-bar > a.leaflet-disabled,
				#alert-close, #player-lookup > .close-container {
					background: #131313eb !important;
					color: #dedede !important;
					border-color: #4e4e4e !important;
				}
				.sidebar-button, .sidebar-input, #alert-close {
					color-scheme: dark;
				}
				.sidebar-input::placeholder {
					color: #a8a8a8 !important;
				}
				.sidebar-button option {
					background: #161616 !important;
					color: #dedede !important;
				}
				.leaflet-control.leaflet-control-layers,
				#sidebar, #server-info, #nation-claims,
				#player-lookup, #player-lookup-loading {
					background: #131313eb !important;
					border-color: #4e4e4e !important;
				}
				#current-map-mode-label, #options-menu, #options-menu label,
				#options-menu .option, #player-lookup, #player-lookup-loading,
				#server-info, #nation-claims, #nation-claims-titlebar,
				.leaflet-popup-content, .leaflet-popup-content * {
					color: #dedede !important;
				}
				div.leaflet-control-layers.link img {
					filter: invert(1);
				}
			`,
		}))
	}
}

function unloadDarkMode() {
	document.documentElement.style.removeProperty('color-scheme')

	const darkModeEl = document.querySelector('#dark-mode')
	if (darkModeEl) darkModeEl.remove()
	waitForElement('.leaflet-map-pane').then(el => el.style.filter = '')
}
//#endregion

//#region Scroll normalization
let scrollListener = null

/** @param {boolean} boxTicked */
function toggleScrollNormalize(boxTicked) {
	localStorage['emcdynmapplus-normalize-scroll'] = boxTicked

	const el = window.document.querySelector('#map')
	return boxTicked ? addScrollNormalizer(el) : removeScrollNormalizer(el)
}

/** @param {HTMLElement} mapEl */
function addScrollNormalizer(mapEl) {
    scrollListener = e => {
        e.preventDefault()  // Prevent default scroll behavior (so Leaflet doesn't zoom immediately)
        triggerScrollEvent(e.deltaY)
    }

    mapEl.addEventListener('wheel', scrollListener, { passive: false })
}

/** @param {HTMLElement} mapEl */
function removeScrollNormalizer(mapEl) {
	mapEl.removeEventListener('wheel', scrollListener)

	document.dispatchEvent(new CustomEvent('EMCDYNMAPPLUS_ADJUST_SCROLL', { detail: 60 }))
}
//#endregion

//#region Entity locator
/**
 * Runs appropriate locator func based on selectValue, passing inputValue as the argument. 
 * @param {string} selectValue
 * @param {string} inputValue
 */
function locate(selectValue, inputValue) {
	const isArchiveMode = currentMapMode() == 'archive'
	switch (selectValue) {
		case 'Town': locateTown(inputValue, isArchiveMode); break
		case 'Nation': locateNation(inputValue, isArchiveMode); break
		case 'Resident': locateResident(inputValue, isArchiveMode); break
	}
}

/** @param {string} date */
function searchArchive(date) {
	if (date == '') return
	const URLDate = date.replaceAll('-', '') // 2026-06-01 -> 20260601
	localStorage['emcdynmapplus-archive-date'] = URLDate // In case 'change' event doesn't already update it
	localStorage['emcdynmapplus-mapmode'] = 'archive'
	location.reload()
}

/** 
 * @param {string} townName
 * @param {boolean} isArchiveMode
 */
async function locateTown(townName, isArchiveMode) {
	townName = townName.trim().toLowerCase()
	if (townName == '') return

	let coords = null
	if (!isArchiveMode) coords = await getTownSpawn(townName)
	if (!coords) coords = getTownMidpoint(townName)

	if (!coords) return showAlert(`Could not find town/capital with name '${townName}'.`, 5)
	updateUrlLocation(coords)
}

/** 
 * @param {string} nationName
 * @param {boolean} isArchiveMode
 */
async function locateNation(nationName, isArchiveMode) {
	nationName = nationName.trim().toLowerCase()
	if (nationName == '') return

	let capitalName = null
	if (!isArchiveMode) {
		const queryBody = { query: [nationName], template: { capital: true } }
		const nations = await postJSON(`${OAPI_BASE}/${CURRENT_MAP}/nations`, queryBody)
		if (nations && nations.length > 0) capitalName = nations[0].capital?.name
	}
	if (!capitalName) {
		const marker = parsedMarkers.find(m => m.nationName && m.nationName.toLowerCase() == nationName && m.isCapital)
		if (marker) capitalName = marker.townName
	}

	if (!capitalName) return showAlert('Searched nation could not be found.', 3)
	await locateTown(capitalName, isArchiveMode)
}

/** 
 * @param {string} residentName
 * @param {boolean} isArchiveMode
 */
async function locateResident(residentName, isArchiveMode) {
	residentName = residentName.trim().toLowerCase()
	if (residentName == '') return

	let townName = null
	if (!isArchiveMode) {
		const queryBody = { query: [residentName], template: { town: true } }
		const players = await postJSON(`${OAPI_BASE}/${CURRENT_MAP}/players`, queryBody)
		if (players && players.length > 0) townName = players[0].town?.name
	}
	if (!townName) {
		const marker = parsedMarkers.find(m => m.residentList && m.residentList.some(r => r.toLowerCase() == residentName))
		if (marker) townName = marker.townName
	}

	if (!townName) return showAlert('Searched resident could not be found.', 3)
	await locateTown(townName, isArchiveMode)
}

/** @param {string} townName */
async function getTownSpawn(townName) {
	const queryBody = { query: [townName], template: { coordinates: true } }
	const towns = await postJSON(`${OAPI_BASE}/${CURRENT_MAP}/towns`, queryBody)
	if (!towns || towns.length < 1) return null

	const spawn = towns[0].coordinates.spawn
	return { x: Math.round(spawn.x), z: Math.round(spawn.z) }
}

/** @param {string} townName */
function getTownMidpoint(townName) {
	const town = parsedMarkers.find(m => m.townName && m.townName.toLowerCase() == townName)
	if (!town) return null

	return { x: town.x, z: town.z }
}

/**
 * Updates the address bar / href with the specified coords and zoom.
 * @param {Vertex} coords
 * @param {number} zoom
 */
function updateUrlLocation(coords, zoom = 4) {
	location.href = `${MAPI_BASE}?zoom=${zoom}&x=${coords.x}&z=${coords.z}`
}
//#endregion
