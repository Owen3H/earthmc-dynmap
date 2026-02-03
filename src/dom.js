console.log('emcdynmapplus: loaded dom')

const htmlCode = {
	// Used in this file
    buttons: {
        locate: '<button class="sidebar-button" id="locate-button">Locate</button>',
        searchArchive: '<button class="sidebar-button" id="archive-button">Search Archive</button>',
        switchMapMode: '<button class="sidebar-button" id="switch-map-mode">Switch Map Mode</button>',
        options: '<button class="sidebar-button" id="options-button">Options</button>',
    },
    options: {
        menu: '<div id="options-menu"></div>',
        option: '<div class="option"></div>',
        label: '<label for="{option}">{optionText}</label>',
        checkbox: '<input id="{option}" type="checkbox" name="{option}">'
    },
	serverInfo: '<div class="leaflet-control-layers leaflet-control" id="server-info"></div>',
    sidebar: '<div class="leaflet-control-layers leaflet-control" id="sidebar"></div>',
    sidebarOption: '<div class="sidebar-option"></div>',
    locateInput: '<input class="sidebar-input" id="locate-input" placeholder="London">',
    locateSelect: '<select class="sidebar-button" id="locate-select"><option>Town</option><option>Nation</option><option>Resident</option></select>',
    archiveInput: `<input class="sidebar-input" id="archive-input" type="date" min="${ARCHIVE_DATE.MIN}" max="${ARCHIVE_DATE.MAX}">`,
    currentMapModeLabel: '<div class="sidebar-option" id="current-map-mode-label">Map Mode: {currentMapMode}</div>',
    alertBox: '<div id="alert"><p id="alert-message">{message}</p><br><button id="alert-close">Dismiss</button></div>',
	darkMode: `<style id="dark-mode">
		.leaflet-control, #alert, .sidebar-input,
		.sidebar-button, .leaflet-bar > a, .leaflet-tooltip-top,
		.leaflet-popup-content-wrapper, .leaflet-popup-tip,
		.leaflet-bar > a.leaflet-disabled {
			background: #131313d4 !important;
			color: #dedede;
		}
		div.leaflet-control-layers.link img {
			filter: invert(1);
		}</style>
	`,

    // Used in main.js
    playerLookup: '<div class="leaflet-control-layers leaflet-control" id="player-lookup"></div>',
    playerLookupLoading: '<div class="leaflet-control-layers leaflet-control" id="player-lookup-loading">Loading...</button>',
    residentClickable: '<span class="resident-clickable">{player}</span>',
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
	const alert = window.document.querySelector('#alert')
	if (alert != null) alert.remove()

	window.document.body.insertAdjacentHTML('beforeend', htmlCode.alertBox.replace('{message}', message))
	const alertClose = window.document.querySelector('#alert-close')
	alertClose.addEventListener('click', event => { event.target.parentElement.remove() })
}

/**
 * Adds element to parent and uses selector to query select an element on parent.
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
	const darkened = localStorage['emcdynmapplus-darkened']
	if (darkened == 'true') {
		waitForElement('.leaflet-tile-pane').then(_ => decreaseBrightness(true))
	}

    const darkPref = localStorage['emcdynmapplus-darkmode']
    const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
    if (darkPref === 'true' || (!darkPref && systemDark)) {
        localStorage['emcdynmapplus-darkmode'] = 'true'
        loadDarkMode()
    }

	const showServerInfo = localStorage['emcdynmapplus-serverinfo'] == 'true' ? true : false
	waitForElement('#server-info').then(_ => toggleServerInfo(showServerInfo))

	// Initialize date input from stored date. 20260801 -> 2026-08-01
	const archiveDate = localStorage['emcdynmapplus-archive-date']
	const formattedDate = archiveDate.slice(0, 4) + '-' + archiveDate.slice(4, 6) + '-' + archiveDate.slice(6, 8)
	waitForElement('#archive-input').then(dateInputEl => dateInputEl.value = formattedDate)
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

    // Fix nameplates appearing over popups
    waitForElement('.leaflet-nameplate-pane').then(el => el.style = '')

	// Listen for click event on a resident clickable and call lookup func with the resident name.
	// Has to be popup-pane because infowindow gets destroyed.
	waitForElement('.leaflet-popup-pane').then(el => el.addEventListener('click', e => {
		/** @type {HTMLElement} */ 
		const target = e.target
		if (target.classList.contains("resident-clickable")) {
			lookupPlayer(target.textContent)
		}
	}))
}

/** @returns {Promise<Element | null>} The "#server-info" element. */
function insertServerInfoPanel() {
	return waitForElement('.leaflet-top.leaflet-right').then(el => {
		disablePanAndZoom(el)
		return addServerInfoPanel(el)
	})
}

/** @returns {Promise<Element | null>} The "#sidebar" element. */
function insertSidebarMenu() {
    return waitForElement('.leaflet-top.leaflet-left').then(el => {
        disablePanAndZoom(el)
        return addMainMenu(el)
    })
}

/**
 * @param {HTMLElement} element - The element to prevent dblckick and mousedown events on.
 */
function disablePanAndZoom(element) {
	// Prevents panning the map when on this element by
	// stopping the mouse event from propogating to Leaflet.
	element.addEventListener('mousedown', e => e.stopPropagation())

	// blocks the map (Leaflet) from zooming when 
	// double clicking in the sidebar main menu.
	element.addEventListener('dblclick', e => {
		e.stopPropagation()
		e.preventDefault()
	})
}

/**
 * @param {HTMLElement} parent - The "leaflet-top leaflet-right" element.
 */
function addServerInfoPanel(parent) {
	const panel = addElement(parent, htmlCode.serverInfo, '#server-info')
	addElement(panel, '<div id="server-info-title">Server Info</div>', '#server-info-title')
	addElement(panel, '<div class="server-info-entry" id="vote-party">Votes until VP: Loading..</div>', '#vote-party')
	addElement(panel, '<br>')
	addElement(panel, '<div class="server-info-entry" id="online-players-count">Online Players: Loading..</div>', '#online-players-count')
	addElement(panel, '<div class="server-info-entry" id="online-nomads-count">Online Nomads: Loading..</div>', '#online-nomads-count')
	addElement(panel, '<br>')
	addElement(panel, '<div class="server-info-entry" id="server-time">Server Time: Loading..</div>', '#server-time')
	addElement(panel, '<div class="server-info-entry" id="new-day-at">New Day In: Loading..</div>', '#new-day-at')
	addElement(panel, '<br>')
	addElement(panel, '<div class="server-info-entry" id="storm">⚡ Storm: Loading..</div>', '#storm')
	addElement(panel, '<div class="server-info-entry" id="thunder">⛈️ Thunder: Loading..</div>', '#thunder')

	return panel
}

/**
 * @param {string} name 
 * @param {string} value 
 */
const serverInfoEntry = (name, value) => {
	const colour = value == 'Yes' ? 'green' : value == 'No' ? 'red' : 'white'
	return `<p style="margin: 0;">${name}: <b style="color: ${colour};">${value}</b></p>`
}

/**
 * @param {HTMLElement} element - The "#server-info" element.
 * @param {ServerInfo} info - The object containing server info.
 */
function renderServerInfo(element, info) {
	const opCount = info.stats?.numOnlinePlayers || 0
	const nomadOpCount = info.stats.numOnlineNomads || 0
	const vpRemaining = info.voteParty.numRemaining

	// Server Time
	const serverTod = info.timestamps.serverTimeOfDay
	const hours = Math.floor(serverTod / 3600)
	const minutes = Math.floor((serverTod % 3600) / 60)

	const displayHour = hours % 12 || 12
	const displayMin = minutes.toString().padStart(2, '0')
	const timeStr = `${displayHour}:${displayMin} ${hours >= 12 ? 'PM' : 'AM'}`

	// New Day In
	const newDayTime = info.timestamps.newDayTime
	let delta = newDayTime - serverTod
	if (delta < 0) delta += 86_400 // 24hr
	const newDayHr = Math.floor(delta / 3600)
	const newDayMin = Math.floor((delta % 3600) / 60)

	element.querySelector("#online-players-count").innerHTML = serverInfoEntry(`Online Players`, opCount)
	element.querySelector("#online-nomads-count").innerHTML = serverInfoEntry(`Online Nomads`, nomadOpCount)
	element.querySelector("#vote-party").innerHTML = serverInfoEntry(`Votes until VP`, vpRemaining > 0 ? vpRemaining : 0)
	element.querySelector("#server-time").innerHTML = serverInfoEntry(`Server Time`, timeStr)
	element.querySelector("#new-day-at").innerHTML = serverInfoEntry(`New Day In`, `${newDayHr}hrs ${newDayMin}m`)
	element.querySelector("#storm").innerHTML = serverInfoEntry(`⚡ Storm`, info.status.hasStorm ? 'Yes' : 'No')
	element.querySelector("#thunder").innerHTML = serverInfoEntry(`⛈️ Thunder`, info.status.isThundering ? 'Yes' : 'No')
}

/**
 * @param {HTMLElement} parent - The "leaflet-top leaflet-left" element.
 */
function addMainMenu(parent) {
	const sidebar = addElement(parent, htmlCode.sidebar, '#sidebar')

	// Locator button and input box
	addLocateMenu(sidebar)

	//#region Archive search and date input
	const archiveContainer = addElement(sidebar, htmlCode.sidebarOption, '.sidebar-option', true)[1]
	const archiveButton = addElement(archiveContainer, htmlCode.buttons.searchArchive, '#archive-button')
	const archiveInput = addElement(archiveContainer, htmlCode.archiveInput, '#archive-input')
	
	// TODO: Does this even work when input is type="date" ?
	archiveInput.addEventListener('keyup', e => { if (e.key == 'Enter') searchArchive(archiveInput.value) })
	archiveInput.addEventListener('change', _ => {
		const URLDate = archiveInput.value.replaceAll('-', '')
		localStorage['emcdynmapplus-archive-date'] = URLDate
	})

	archiveButton.addEventListener('click', _ => searchArchive(archiveInput.value))
	//#endregion

	// Switch map mode button
	const switchMapModeButton = addElement(sidebar, htmlCode.buttons.switchMapMode, '#switch-map-mode')
	switchMapModeButton.addEventListener('click', _ => switchMapMode())

	// Options button and checkboxes
	addOptions(sidebar)

	// Current map mode label
	const currentMapModeLabel = addElement(sidebar, htmlCode.currentMapModeLabel, '#current-map-mode-label')
	currentMapModeLabel.textContent = currentMapModeLabel.textContent.replace('{currentMapMode}', currentMapMode())

	return sidebar
}

/** @param {HTMLElement} sidebar */
function addOptions(sidebar) {
	const optionsButton = addElement(sidebar, htmlCode.buttons.options, '#options-button')
	const optionsMenu = addElement(sidebar, htmlCode.options.menu, '#options-menu')
	optionsMenu.style.display = 'none'
	optionsButton.addEventListener('click', _ => {
		optionsMenu.style.display = (optionsMenu.style.display == 'none') ? 'unset' : 'none'
	})

	const checkbox = {
		decreaseBrightness: addCheckboxOption(0, 'toggle-darkened', 'Decrease brightness', 'darkened'),
		darkMode: addCheckboxOption(1, 'toggle-darkmode', 'Toggle dark mode', 'darkmode'),
		serverInfo: addCheckboxOption(2, 'toggle-serverinfo', 'Display server info', 'serverinfo'),
		//loadBorders: addCheckboxOption(3, 'toggle-load-borders', 'Load country borders', 'load-borders')
	}

	checkbox.decreaseBrightness.addEventListener('change', event => decreaseBrightness(event.target.checked))
	checkbox.darkMode.addEventListener('change', event => toggleDarkMode(event.target.checked))
	checkbox.serverInfo.addEventListener('change', event => toggleServerInfo(event.target.checked))
	//checkbox.loadBorders.addEventListener('change', event => toggleBorders(event.target.checked))
}

/**
 * Adds a option which displays a checkbox
 * @param {number} index - The number determining the order of this option in the list 
 * @param {string} optionId - The unique string used to query this option
 * @param {string} optionText - The text to display next to the checkbox
 * @param {string} variable - The variable name in storage used to keep the 'checked' state 
 */
function addCheckboxOption(index, optionId, optionText, variable) {
	const optionsMenu = document.querySelector('#options-menu')
	const option = addElement(optionsMenu, htmlCode.options.option, '.option', true)[index]
	option.insertAdjacentHTML('beforeend', htmlCode.options.label
		.replace('{option}', optionId)
		.replace('{optionText}', optionText))
	
	// Initialize checkbox state
	const checkbox = addElement(option, htmlCode.options.checkbox.replace('{option}', optionId), '#' + optionId)
	checkbox.checked = (localStorage['emcdynmapplus-' + variable] == 'true')
	return checkbox
}

/** @param {HTMLElement} sidebar */
function addLocateMenu(sidebar) {
	const locateMenu = addElement(sidebar, '<div id="locate-menu"></div>', '#locate-menu')
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

/** 
 * @param {boolean} boxTicked 
 * @param {number} percentage - The amount to decrease brightness by.
 */
function decreaseBrightness(boxTicked, percentage = 45) {
	const element = document.querySelector('.leaflet-tile-pane')
	localStorage['emcdynmapplus-darkened'] = boxTicked
	element.style.filter = boxTicked ? `brightness(${100-percentage}%)` : ''
}

/** @param {boolean} boxTicked */
function toggleServerInfo(boxTicked) {
	localStorage['emcdynmapplus-serverinfo'] = boxTicked
	const serverInfoPanel = document.querySelector('#server-info')
	serverInfoPanel?.setAttribute('style', `visibility: ${boxTicked ? 'visible' : 'hidden'}`)

	if (boxTicked) {
		if (serverInfoScheduler == null) updateServerInfo(serverInfoPanel) // immediate fetch without spam
	} else {
		if (serverInfoScheduler != null) clearTimeout(serverInfoScheduler) // stop future runs
		serverInfoScheduler = null
	}
}

/** @param {boolean} boxTicked */
// function toggleBorders(boxTicked) {
// 	localStorage['emcdynmapplus-load-borders'] = boxTicked
// 	location.reload()
// }

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
	const URLDate = date.replaceAll('-', '') // 2026-06-01 -> 20260601
	localStorage['emcdynmapplus-archive-date'] = URLDate // In case 'change' event doesn't already update it
	localStorage['emcdynmapplus-mapmode'] = 'archive'
	location.reload()
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