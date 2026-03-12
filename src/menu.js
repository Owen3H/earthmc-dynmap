/** ANY CODE RELATING TO THE MAIN ONSCREEN EXTENSION MENU GOES HERE */
//console.log('emcdynmapplus: loaded menu')

/** @param {HTMLElement} parent - The "leaflet-top leaflet-left" element. */
function addMainMenu(parent) {
	const sidebar = addElement(parent, INSERTABLE_HTML.sidebar)
	addLocateMenu(sidebar) // Locator button and input box

	//#region Archive search and date input
	const archiveContainer = addElement(sidebar, INSERTABLE_HTML.sidebarOption, '.sidebar-option', true)[1]
	const archiveButton = addElement(archiveContainer, INSERTABLE_HTML.buttons.searchArchive)
	const archiveInput = addElement(archiveContainer, INSERTABLE_HTML.archiveInput)
	
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
	const switchMapModeButton = addElement(sidebar, INSERTABLE_HTML.buttons.switchMapMode)
	switchMapModeButton.addEventListener('click', _ => switchMapMode(curMapMode))

	// Options button and checkboxes
	addOptions(sidebar, curMapMode)

	// Current map mode label
	const currentMapModeLabel = addElement(sidebar, INSERTABLE_HTML.currentMapModeLabel)
	currentMapModeLabel.textContent = currentMapModeLabel.textContent.replace('{currentMapMode}', curMapMode)

	return sidebar
}

/** 
 * @param {HTMLElement} sidebar 
 * @param {MapMode} curMapMode 
*/
function addOptions(sidebar, curMapMode) {
	const optionsButton = addElement(sidebar, INSERTABLE_HTML.buttons.options)
	const optionsMenu = addElement(sidebar, INSERTABLE_HTML.options.menu)
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
	/** @type {HTMLElement} */
	const option = addElement(menu, INSERTABLE_HTML.options.option, '.option', true)[index]
	option.insertAdjacentHTML('beforeend', INSERTABLE_HTML.options.label
		.replace('{option}', optionId)
		.replace('{optionText}', optionText))
	
	// Initialize checkbox state
	/** @type {HTMLInputElement} */
	const checkbox = addElement(option, INSERTABLE_HTML.options.checkbox.replace('{option}', optionId), '#' + optionId)
	checkbox.checked = (localStorage['emcdynmapplus-' + variable] == 'true')
	return checkbox
}

/** @param {HTMLElement} sidebar */
function addLocateMenu(sidebar) {
	const locateMenu = addElement(sidebar, '<div id="locate-menu"></div>', '#locate-menu')
	const locateButton = addElement(locateMenu, INSERTABLE_HTML.buttons.locate, '#locate-button')
	const locateSubmenu = addElement(locateMenu, INSERTABLE_HTML.sidebarOption, '.sidebar-option')
	const locateSelect = addElement(locateSubmenu, INSERTABLE_HTML.locateSelect, '#locate-select')
	const locateInput = addElement(locateSubmenu, INSERTABLE_HTML.locateInput, '#locate-input')
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
	element.style.filter = boxTicked ? getTilePaneFilter() : ''
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
	document.head.insertAdjacentHTML('beforeend', INSERTABLE_HTML.interFont)
	// other stylesheet html links ... 
}

function loadDarkMode() {
	// tell browser not to apply its auto dark mode.
	// this fixes some inverted elements when both are enabled.
	document.documentElement.style.colorScheme = 'dark'
	document.head.insertAdjacentHTML('beforeend', INSERTABLE_HTML.darkMode)
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

	const eventData = { detail: { pxPerZoomLevel: 60 } }
	document.dispatchEvent(new CustomEvent('EMCDYNMAPPLUS_ADJUST_SCROLL', eventData))
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