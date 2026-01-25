const htmlCode = {
	// Used in this file
    buttons: {
        locate: '<button class="sidebar-button" id="locate-button">Locate</button>',
        searchArchive: '<button class="sidebar-button" id="archive-button">Search Archive</button>',
        options: '<button class="sidebar-button" id="options-button">Options</button>',
        switchMapMode: '<button class="sidebar-button" id="switch-map-mode">Switch Map Mode</button>'
    },
    options: {
        menu: '<div id="options-menu"></div>',
        option: '<div class="option"></div>',
        label: '<label for="{option}">{optionName}</label>',
        checkbox: '<input id="{option}" type="checkbox" name="{option}">'
    },
    sidebar: '<div class="leaflet-control-layers leaflet-control" id="sidebar"></div>',
    sidebarOption: '<div class="sidebar-option"></div>',
    locateInput: '<input class="sidebar-input" id="locate-input" placeholder="London">',
    locateSelect: '<select class="sidebar-button" id="locate-select"><option>Town</option><option>Nation</option><option>Resident</option></select>',
    archiveInput: `<input class="sidebar-input" id="archive-input" type="date" min="2022-05-01" max="${new Date().toLocaleDateString('en-ca')}">`,
    currentMapModeLabel: '<div class="sidebar-option" id="current-map-mode-label">Map Mode: {currentMapMode}</div>',
    alertBox: '<div id="alert"><p id="alert-message">{message}</p><br><button id="alert-close">Dismiss</button></div>',
	darkMode: `<style id="dark-mode">
		.leaflet-control, #alert, .sidebar-input,
		.sidebar-button, .leaflet-bar > a, .leaflet-tooltip-top,
		.leaflet-popup-content-wrapper, .leaflet-popup-tip,
		.leaflet-bar > a.leaflet-disabled {
			background: #131313;
			color: #dedede;
		}
		div.leaflet-control-layers.link img {
			filter: invert(1);
		}</style>
	`,

    // Used in main.js
    playerLookup: '<div class="leaflet-control-layers leaflet-control" id="player-lookup"></div>',
    playerLookupLoading: '<div class="leaflet-control-layers leaflet-control" id="player-lookup-loading">Loading...</button>',
    residentClickable: '<span class="resident-clickable" onclick="lookupPlayer(\'{player}\')">{player}</span>',
    residentList: '<span class="resident-list">\t{list}</span>',
    scrollableResidentList: '<div class="resident-list" id="scrollable-list">\t{list}</div>',
    partOfLabel: '<span id="part-of-label">Part of <b>{allianceList}</b></span>',
    alertMsg: '<div class="message" id="alert"><p id="alert-message">{message}</p></div>'
}

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

function initToggleOptions() {
    waitForElement('.leaflet-tile-pane').then(() => {
        if (localStorage['emcdynmapplus-darkened'] === 'true') decreaseBrightness(true)
    })

    const darkPref = localStorage['emcdynmapplus-darkmode']
    const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
    if (darkPref === 'true' || (!darkPref && systemDark)) {
        localStorage['emcdynmapplus-darkmode'] = 'true'
        loadDarkMode()
    }
}

function editUILayout() {
    // move the +- zoom control buttons to the bottom instead of top
    // and make sure the link and coordinates buttons align with it
    waitForElement('.leaflet-bottom.leaflet-left').then(async el => {
        const link = await waitForElement('.leaflet-control-layers.link')
        const coordinates = await waitForElement('.leaflet-control-layers.coordinates')
        if (link || coordinates) {
            // Create a wrapper div
            const wrapper = document.createElement('div')
            wrapper.style.alignSelf = 'end'

            // Move elements into wrapper
            if (link) wrapper.appendChild(link)
            if (coordinates) wrapper.appendChild(coordinates)

            el.appendChild(wrapper)
        }

        const zoomControl = await waitForElement('.leaflet-control-zoom')
        if (zoomControl) el.insertBefore(zoomControl, el.firstChild)
    })

    // Keep the layer toggle on the right of the main menu
    waitForElement('.leaflet-control-layers-toggle').then(el => {
        if (el?.parentElement) {
            el.parentElement.style.clear = 'none'
        }
    })

    // Fix nameplates appearing over popups
    waitForElement('.leaflet-nameplate-pane').then(el => el.style = '')
}

function insertSidebarMenu() {
    waitForElement('.leaflet-top.leaflet-left').then(el => {
        addMainMenu(el)

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
}

/**
 * @param {HTMLElement} parent - The "leaflet-top leaflet-left" element.
 */
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
	const switchMapModeButton = addElement(sidebar, htmlCode.buttons.switchMapMode, '#switch-map-mode')
	switchMapModeButton.addEventListener('click', () => switchMapMode())

	addOptions(sidebar)

	// Current map mode label
	const currentMapModeLabel = addElement(sidebar, htmlCode.currentMapModeLabel, '#current-map-mode-label')
	currentMapModeLabel.textContent = currentMapModeLabel.textContent.replace('{currentMapMode}', currentMapMode())
}

/**
 * @param {boolean} boxTicked 
 */
function decreaseBrightness(boxTicked) {
	const element = document.querySelector('.leaflet-tile-pane')
	localStorage['emcdynmapplus-darkened'] = boxTicked
	element.style.filter = boxTicked ? 'brightness(50%)' : ''
}

/** @param {boolean} boxTicked */
function toggleDarkMode(boxTicked) {
	localStorage['emcdynmapplus-darkmode'] = boxTicked
	return boxTicked ? loadDarkMode() : unloadDarkMode()
}

function loadDarkMode() {
	// tell browser not to apply its auto dark mode.
	// this fixes some inverted elements when both are enabled.
	document.documentElement.style.colorScheme = 'dark'
	document.head.insertAdjacentHTML('beforeend', htmlCode.darkMode)
}

function unloadDarkMode() {
	document.documentElement.style.removeProperty('color-scheme')

	const darkModeEl = document.querySelector('#dark-mode')
	if (darkModeEl) darkModeEl.remove()
	waitForElement('.leaflet-map-pane').then(el => el.style.filter = '')
}

/**
 * Runs appropriate locator func based on selectValue, passing inputValue as the argument. 
 * @param {string} selectValue
 * @param {string} inputValue
 */
function locate(selectValue, inputValue) {
	switch (selectValue) {
		case 'Town': locateTown(inputValue); break
		case 'Nation': locateNation(inputValue); break
		case 'Resident': locateResident(inputValue); break
	}
}

/** @param {string} date */
function searchArchive(date) {
	if (date == '') return
	const URLDate = date.replaceAll('-', '')
	localStorage['emcdynmapplus-archive-date'] = URLDate
	localStorage['emcdynmapplus-mapmode'] = 'archive'
	location.reload()
}

/** @param {HTMLElement} sidebar */
function addOptions(sidebar) {
	const optionsButton = addElement(sidebar, htmlCode.buttons.options, '#options-button')
	const optionsMenu = addElement(sidebar, htmlCode.options.menu, '#options-menu')
	optionsMenu.style.display = 'none'
	optionsButton.addEventListener('click', () => {
		optionsMenu.style.display = (optionsMenu.style.display == 'none') ? 'unset' : 'none'
	})

	const checkbox = {
		decreaseBrightness: addCheckboxOption(0, 'decrease-brightness', 'Decrease brightness', 'darkened'),
		darkMode: addCheckboxOption(1, 'toggle-darkmode', 'Toggle dark mode', 'darkmode')
	}

	checkbox.decreaseBrightness.addEventListener('change', event => decreaseBrightness(event.target.checked))
	checkbox.darkMode.addEventListener('change', event => toggleDarkMode(event.target.checked))
}

/**
 * 
 * @param {number} index 
 * @param {string} optionId 
 * @param {string} optionName 
 * @param {string} variable 
 * @returns 
 */
function addCheckboxOption(index, optionId, optionName, variable) {
	const optionsMenu = document.querySelector('#options-menu')
	const option = addElement(optionsMenu, htmlCode.options.option, '.option', true)[index]
	option.insertAdjacentHTML('beforeend', htmlCode.options.label
		.replace('{option}', optionId)
		.replace('{optionName}', optionName))
	
	const checkbox = addElement(option, htmlCode.options.checkbox.replace('{option}', optionId), '#' + optionId)
	checkbox.checked = (localStorage['emcdynmapplus-' + variable] == 'true')
	return checkbox
}

/** @param {HTMLElement} sidebar */
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

/** @param {string} town */
async function locateTown(town) {
	town = town.trim().toLowerCase()
	if (town == '') return

	const coords = await getTownSpawn(town)
	if (coords == false) return showAlert('Searched town has not been found.')
	if (coords == null) return showAlert('Service is currently unavailable, please try later.')

	location.href = `${MAPI_BASE}?zoom=4&x=${coords.x}&z=${coords.z}`
}

/** @param {string} nation */
async function locateNation(nation) {
	nation = nation.trim().toLowerCase()
	if (nation == '') return

	const query = { query: [nation], template: { capital: true } }
	const data = await fetchJSON(`${OAPI_BASE}/${CURRENT_MAP}/nations`, {method: 'POST', body: JSON.stringify(query)})
	if (data == false) return showAlert('Searched nation has not been found.')
	if (data == null) return showAlert('Service is currently unavailable, please try later.')

	const capital = data[0].capital.name
	const coords = await getTownSpawn(capital)
	if (coords == false) return showAlert('Unexpected error occurred while searching for nation, please try later.')
	if (coords == null) return showAlert('Service is currently unavailable, please try later.')
	location.href = `${MAPI_BASE}?zoom=4&x=${coords.x}&z=${coords.z}`
}

/** @param {string} resident */
async function locateResident(resident) {
	resident = resident.trim().toLowerCase()
	if (resident == '') return

	const query = { query: [resident], template: { town: true } }
	const data = await fetchJSON(`${OAPI_BASE}/${CURRENT_MAP}/players`, {method: 'POST', body: JSON.stringify(query)})
	if (data == false) return showAlert('Searched resident has not been found.')
	if (data == null) return showAlert('Service is currently unavailable, please try later.')

	const town = data[0].town.name
	if (!town) return showAlert('The searched resident is townless.')
	const coords = await getTownSpawn(town)
	if (coords == false) return showAlert('Unexpected error occurred while searching for resident, please try later.')
	if (coords == null) return showAlert('Service is currently unavailable, please try later.')
	location.href = `${MAPI_BASE}?zoom=4&x=${coords.x}&z=${coords.z}`
}

/** @param {string} town */
async function getTownSpawn(town) {
	const query = { query: [town], template: { coordinates: true } }
	const data = await fetchJSON(`${OAPI_BASE}/${CURRENT_MAP}/towns`, {method: 'POST', body: JSON.stringify(query)})
	if (data == false || data == undefined) return false
	if (data == null) return null

	const spawn = data[0].coordinates.spawn
	return { x: Math.round(spawn.x), z: Math.round(spawn.z) }
}