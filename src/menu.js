/** ANY CODE RELATING TO THE MAIN ONSCREEN EXTENSION MENU GOES HERE */
//console.log('emcdynmapplus: loaded menu')

// TODO: Use Custom Element Registry and convert the main menu into one.

/** @param {HTMLElement} parent - The "leaflet-top leaflet-left" element. */
function addMainMenu(parent) {
	const menu = addElement(parent, INSERTABLE_HTML.menu)
	addLocateSection(menu) // Locator button and input box
	addArchiveSection(menu)

	// Options button and checkboxes
	addOptions(menu, currentMapMode())

	return menu
}

/** @param {HTMLElement} menu */
function addLocateSection(menu) {
	const locateMenu = addElement(menu, INSERTABLE_HTML.locateMenu)
	const locateButton = addElement(locateMenu, INSERTABLE_HTML.buttons.locate)
	const locateSubmenu = addElement(locateMenu, INSERTABLE_HTML.menuOption, '.menu-option')

	//#region sub menu (dropdown and input)
	const locateSelect = addElement(locateSubmenu, INSERTABLE_HTML.locateSelect)
	const locateInput = addElement(locateSubmenu, INSERTABLE_HTML.locateInput)
	locateSelect.addEventListener('change', () => {
		switch (locateSelect.value) {
			case 'Town': locateInput.placeholder = 'London'; break
			case 'Nation': locateInput.placeholder = 'Nubia'; break
			case 'Resident': locateInput.placeholder = 'Fix'; break
		}
	})
	locateInput.addEventListener('keyup', event => {
		if (event.key != 'Enter') return
		locate(locateSelect.value, locateInput.value)
	})
	locateButton.addEventListener('click', () => {
		locate(locateSelect.value, locateInput.value)
	})
	//#endregion
}

/** @param {HTMLElement} menu */
function addArchiveSection(menu) {
	const archiveMenu = addElement(menu, INSERTABLE_HTML.archiveMenu)
	const archiveButton = addElement(archiveMenu, INSERTABLE_HTML.buttons.searchArchive)
	const archiveInput = addElement(archiveMenu, INSERTABLE_HTML.archiveInput)
	
	archiveButton.addEventListener('click', _ => searchArchive(archiveInput.value))

	// TODO: Typing in a bogus date will cause infinite "Loading archive..."
	archiveInput.addEventListener('keyup', e => { if (e.key == 'Enter') searchArchive(archiveInput.value) })
	archiveInput.addEventListener('change', _ => {
		const URLDate = archiveInput.value.replaceAll('-', '')
		localStorage['emcdynmapplus-archive-date'] = URLDate
	})
}

/** 
 * @param {HTMLElement} menu 
 * @param {MapMode} curMapMode 
*/
function addOptions(menu, curMapMode) {
	const optionsButton = addElement(menu, INSERTABLE_HTML.buttons.options)
	const optionsMenu = addElement(menu, INSERTABLE_HTML.options.menu)
	optionsMenu.style.display = 'none'
	optionsButton.addEventListener('click', _ => {
		optionsMenu.style.display = (optionsMenu.style.display == 'none') ? 'grid' : 'none'
		optionsButton.textContent = (optionsMenu.style.display == 'none') ? 'Show Options' : 'Close Options'
	})

	let i = 0
	addCheckboxOption(optionsMenu, i++, 'toggle-normalize-scroll', 'Normalize scroll inputs', 'normalize-scroll', e => 
		toggleScrollNormalize(e.target.checked)
	)
	addCheckboxOption(optionsMenu, i++, 'toggle-darkened', 'Decrease brightness', 'darkened', e => toggleDarkened(e.target.checked))
	addCheckboxOption(optionsMenu, i++, 'toggle-darkmode', 'Toggle dark mode', 'darkmode', e => toggleDarkMode(e.target.checked))
	addCheckboxOption(optionsMenu, i++, 'toggle-serverinfo', 'Display server info', 'serverinfo', e => toggleServerInfo(e.target.checked))
	
	if (curMapMode != 'archive') {
		addCheckboxOption(optionsMenu, i++, 'toggle-playerlist', 'Display player list', 'playerlist', 
			e => togglePlayerList(e.target.checked)
		)
		addCheckboxOption(
			optionsMenu, i++, 'toggle-capital-stars', 'Show capital stars', 'capital-stars', 
			e => toggleShowCapitalStars(e.target.checked)
		)
	}
}

/**
 * Adds a option which displays a checkbox with an optional listener which triggers when the checkbox is toggled. 
 * The checkbox's state is saved in local storage under the key 'emcdynmapplus-{variable}'.
 * @param {number} index - The number determining the order of this option in the list 
 * @param {string} optionId - The unique string used to query this option
 * @param {string} optionText - The text to display next to the checkbox
 * @param {string} variable - The variable name in storage used to keep the 'checked' state 
 * @param {(e: Event) => void} listener - An optional function to call when the checkbox is toggled
 */
function addCheckboxOption(menu, index, optionId, optionText, variable, listener) {
	/** @type {HTMLElement} */
	const option = addElement(menu, INSERTABLE_HTML.options.option, '.option', true)[index]
	option.insertAdjacentHTML('beforeend', INSERTABLE_HTML.options.label
		.replace('{option}', optionId)
		.replace('{optionText}', optionText))
	
	// Initialize checkbox state
	/** @type {HTMLInputElement} */
	const checkbox = addElement(option, INSERTABLE_HTML.options.checkbox.replace('{option}', optionId), '#' + optionId)
	checkbox.checked = (localStorage['emcdynmapplus-' + variable] == 'true')
	
	if (listener) checkbox.addEventListener('change', listener)
	return checkbox
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

	const visibility = boxTicked ? 'visible' : 'hidden'
	const float = boxTicked ? 'none !important' : 'right !important'
	serverInfoPanel?.setAttribute('style', `visibility: ${visibility}; float: ${float};`)

	if (!boxTicked) {
		if (serverInfoScheduler != null) clearTimeout(serverInfoScheduler) // stop future runs
		serverInfoScheduler = null

		return
	}

	if (serverInfoScheduler == null) updateServerInfo(serverInfoPanel) // immediate fetch without spam
}

/** @param {boolean} boxTicked */
function togglePlayerList(boxTicked) {
	localStorage['emcdynmapplus-playerlist'] = boxTicked
	const playerList = document.getElementById('players')

	const isVisible = boxTicked ? 'grid' : 'none'
	playerList?.setAttribute('style', `display: ${isVisible};`)

	if (boxTicked) showAlert('If the player tracking functionality breaks, just hit refresh :)', 1.5)
}

/** @param {boolean} boxTicked */
function toggleShowCapitalStars(boxTicked) {
	localStorage['emcdynmapplus-capital-stars'] = boxTicked

	const pane = document.querySelector('.leaflet-pane.leaflet-marker-pane')
	if (!pane) return

	const imgs = pane.querySelectorAll('img')
	for (const img of imgs) {
		const src = img.getAttribute('src') || ''
		if (!src.endsWith('towny_capital_icon.png')) continue
		
		img.style.visibility = boxTicked ? 'visible' : 'hidden'
	}
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
	const isArchiveMode = currentMapMode() == MapMode.ARCHIVE
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
	localStorage['emcdynmapplus-mapmode'] = MapMode.ARCHIVE.name
	location.reload()
}

/** 
 * @param {string} name
 * @param {boolean} isArchiveMode
 */
async function locateTown(name, isArchiveMode) {
	name = name.trim()

	const townName = name.toLowerCase()
	if (townName == '') return

	let coords = null
	if (!isArchiveMode) coords = await getTownSpawn(townName)
	if (!coords) coords = getTownMidpoint(townName)

	if (!coords) return showAlert(`Could not find town/capital with name '${name}'.`, 5)
	updateUrlLocation(coords)
}

/** 
 * @param {string} name
 * @param {boolean} isArchiveMode
 */
async function locateNation(name, isArchiveMode) {
	name = name.trim()
	
	const nationName = name.toLowerCase()
	if (nationName == '') return

	let capitalName = null
	if (!isArchiveMode) {
		const queryBody = { query: [nationName], template: { capital: true } }
		const nations = await postJSON(`${currentMapApiUrl()}/nations`, queryBody)
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
 * @param {string} name
 * @param {boolean} isArchiveMode
 */
async function locateResident(name, isArchiveMode) {
	name = name.trim()

	const residentName = name.toLowerCase()
	if (residentName == '') return

	let townName = null
	if (!isArchiveMode) {
		const queryBody = { query: [residentName], template: { town: true } }
		const players = await postJSON(`${currentMapApiUrl()}/players`, queryBody)
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
	const towns = await postJSON(`${currentMapApiUrl()}/towns`, queryBody)
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