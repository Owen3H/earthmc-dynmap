/** ANYTHING RELATED TO UI ELEMENTS OR DOM MANIPULATION BELONGS IN THIS FILE */
console.log('emcdynmapplus: loaded dom')

const ARCHIVE_DATE = {
	MIN: "2022-05-01",
	MAX: new Date().toLocaleDateString()
}

const htmlCode = /** @type {const} */ ({
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
        checkbox: '<input id="{option}" type="checkbox">'
    },
	nationClaims: '<div class="leaflet-control-layers leaflet-control" id="nation-claims"></div>',
	nationClaimsColorInput: '<input type="color" id="nation-color-entry{index}"></input>',
	nationClaimsTextInput: '<input type="text" id="nation-text-entry{index}" placeholder="Enter nation name..." style="margin-left: 5px"></input>',
	serverInfo: '<div class="leaflet-control-layers leaflet-control" id="server-info"></div>',
    sidebar: '<div class="leaflet-control-layers leaflet-control" id="sidebar"></div>',
    sidebarOption: '<div class="sidebar-option"></div>',
    locateInput: '<input class="sidebar-input" id="locate-input" placeholder="London">',
    locateSelect: '<select class="sidebar-button" id="locate-select"><option>Town</option><option>Nation</option><option>Resident</option></select>',
    archiveInput: `<input class="sidebar-input" id="archive-input" type="date" min="${ARCHIVE_DATE.MIN}" max="${ARCHIVE_DATE.MAX}">`,
    currentMapModeLabel: '<div class="sidebar-option" id="current-map-mode-label">Map Mode: {currentMapMode}</div>',
    alertBox: '<div id="alert"><p id="alert-message">{message}</p><button id="alert-close">Dismiss</button></div>',
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
})

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
 * @param {string} elementHTML
 * @param {string} selector
 * @param {boolean} all
 */
function addElement(parent, elementHTML, selector=null, all=false) {
	parent.insertAdjacentHTML('beforeend', elementHTML)
	if (!selector) return parent.lastElementChild
	return all ? parent.querySelectorAll(selector) : parent.querySelector(selector) 
}

/**
 * Append HTML to a parent and return elements. This is slightly slower than addElement 
 * but is more flexible and reduces confusing code in certain circumstances.
 * @param {Object} [options]
 * @param {string} [options.selector] - optional query selector *inside* inserted nodes. null = self
 * @param {boolean} [options.all=false] - return all matching nodes
 * @param {boolean} [options.wrap=false] - wrap HTML in a container div before appending
 */
function appendHTML(parent, html, { selector, all = false, wrap = false } = {}) {
	const templ = document.createElement('template')
	templ.innerHTML = html.trim()

	let nodes = Array.from(templ.content.children)
	if (!wrap) parent.append(...nodes)
	else {
		const container = document.createElement('div')
		container.append(...nodes)
		parent.appendChild(container)
		nodes = [container]
	}
	
	if (!selector) return all ? nodes : nodes[0] || null
	const found = wrap
		? nodes[0].querySelectorAll(selector)
		: nodes.flatMap(n => Array.from(n.querySelectorAll(selector)))

	return all ? found : found[0] || null
}

/**
 * @param {string} selector
 * @returns {Promise<HTMLElement | null>}
 */
const waitForElement = selector => new Promise(resolve => {
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

/**
 * Calls `callback` whenever the element's href changes
 * @param {Element} element
 * @param {HTMLElement} anchorParent
 * @param {() => HTMLElement} getAnchor
 * @param {(newHref: string, lastHref: string) => void} callback
 */
function onAnchorUpdate(anchorParent, getAnchor, callback) {
	let lastHref = null
	const check = () => {
		const anchor = getAnchor()
		if (!anchor) return

		const href = anchor.href
		if (href !== lastHref) {
			callback(href, lastHref)
			lastHref = href
		}
	}

	const observer = new MutationObserver(check)
	observer.observe(anchorParent, { childList: true, subtree: true, attributes: true })

	check()
	return observer
}

function initToggleOptions() {
	const darkened = localStorage['emcdynmapplus-darkened'] == 'true' ? true : false
	waitForElement('.leaflet-tile-pane').then(_ => toggleDarkened(darkened))

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

	const showCapitalStars = localStorage['emcdynmapplus-capital-stars'] == 'true' ? true : false
	waitForElement('.leaflet-pane.leaflet-marker-pane').then(_ => toggleShowCapitalStars(showCapitalStars))
	
	const normalizeScroll = localStorage['emcdynmapplus-normalize-scroll'] == 'true' ? true : false
	toggleScrollNormalize(normalizeScroll)
}

async function editUILayout() {
    const coordinates = await waitForElement('.leaflet-control-layers.coordinates')
	const link = await waitForElement('.leaflet-control-layers.link')

	// Change the link/anchor coords button so that it doesn't 
	// reload the page and just updates the address bar.
	onAnchorUpdate(link, () => link?.querySelector('a'), (newHref, _) => {
		link.onclick = e => {
			e.preventDefault()
			e.stopPropagation()
			history.replaceState(null, '', newHref)
			showAlert('Updated URL with current camera coordinates. Next refresh will navigate there automatically.')
		}
	})

    // move the +- zoom control buttons to the bottom instead of top
    // and make sure the link and coordinates buttons align with it
    waitForElement('.leaflet-bottom.leaflet-left').then(async el => {
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

/** @returns {Promise<Element | null>} The "#nation-claims" element. */
function tryInsertNationClaimsPanel() {
	const mode = localStorage['emcdynmapplus-mapmode']
	if (mode != 'nationclaims') return null

	return waitForElement('.leaflet-bottom.leaflet-right').then(el => {
		disablePanAndZoom(el)
		return addNationClaimsPanel(el)
	})
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

/** @param {HTMLElement} panel - The "#nation-claims" element. */
function loadNationClaims(panel) {
	/** @type {Array<{color: string|null, input: string|null>}} */
	const entries = JSON.parse(localStorage['emcdynmapplus-nation-claims-info'] || '[]')
	entries.forEach((entry, i) => {
		const color = panel.querySelector(`#nation-color-entry${i+1}`)
		const text = panel.querySelector(`#nation-text-entry${i+1}`)
		if (color) color.value = entry.color || ''
		if (text) text.value = entry.input || ''
	})
}

/** @param {HTMLElement} parent - The "leaflet-bottom leaflet-right" element. */
function addNationClaimsPanel(parent) {
	/** @type {HTMLElement} */
	const panel = addElement(parent, htmlCode.nationClaims)
	addElement(panel, '<div id="nation-claims-title">Nation Claims Customizer</div>')
	
	const entriesContainer = addElement(panel, '<div id="nation-claims-entry-container"></div>')
	for (let i = 1; i <= 10; i++) {
		const colInput = htmlCode.nationClaimsColorInput.replace('{index}', i) 
		const txtInput = htmlCode.nationClaimsTextInput.replace('{index}', i)

		const id = `nation-claims-entry${i}`
		addElement(entriesContainer, `<div class="nation-claims-entry" id="${id}">${colInput}${txtInput}</div>`)
	}

	const optDiv1 = addElement(panel, '<div class="nation-claims-checkbox-option"></div>')
	const optDiv2 = addElement(panel, '<div class="nation-claims-checkbox-option"></div>')

	/** @type {HTMLElement} */
	const showExcludedCheckbox = appendHTML(optDiv1, 
		htmlCode.options.checkbox.replace('{option}', 'show-excluded') + 
		htmlCode.options.label.replace('{option}', 'show-excluded').replace('{optionText}', 'Show irrelevant towns')
	)
	showExcludedCheckbox.checked = localStorage['emcdynmapplus-nation-claims-show-excluded'] == 'true' ? true : false
	showExcludedCheckbox.addEventListener('change', e =>
		localStorage['emcdynmapplus-nation-claims-show-excluded'] = e.target.checked
	)

	/** @type {HTMLElement} */
	const useOpaqueCheckbox = appendHTML(optDiv2,
		htmlCode.options.checkbox.replace('{option}', 'use-opaque-colors') + 
		htmlCode.options.label.replace('{option}', 'use-opaque-colors').replace('{optionText}', 'Use opaque colors')
	)
	useOpaqueCheckbox.checked = localStorage['emcdynmapplus-nation-claims-opaque-colors'] == 'true' ? true : false
	useOpaqueCheckbox.addEventListener('change', e =>
		localStorage['emcdynmapplus-nation-claims-opaque-colors'] = e.target.checked
	)

	/** @type {HTMLElement} */
	const applyBtn = appendHTML(panel, '<button class="sidebar-button" id="nation-claims-apply">Apply</button>', { 
		selector: '#nation-claims-apply', 
		wrap: true
	})
	applyBtn.addEventListener('click', () => {
		const entries = []
		for (let i = 1; i <= 10; i++) {
			const colorInput = panel.querySelector(`#nation-color-entry${i}`)
			const textInput = panel.querySelector(`#nation-text-entry${i}`)
			entries.push({
				color: colorInput?.value || null,
				input: textInput?.value || null
			})
		}

		localStorage['emcdynmapplus-nation-claims-info'] = JSON.stringify(entries)
		location.reload()
	})

	return panel
}

/** @param {HTMLElement} parent - The "leaflet-top leaflet-right" element. */
function addServerInfoPanel(parent) {
	const panel = addElement(parent, htmlCode.serverInfo)
	addElement(panel, '<div id="server-info-title">Server Info</div>')
	addElement(panel, '<div class="server-info-entry" id="vote-party">Votes until VP: Loading..</div>')
	addElement(panel, '<br>')
	addElement(panel, '<div class="server-info-entry" id="online-players-count">Online Players: Loading..</div>')
	addElement(panel, '<div class="server-info-entry" id="online-nomads-count">Online Townless: Loading..</div>')
	addElement(panel, '<br>')
	addElement(panel, '<div class="server-info-entry" id="server-time">Server Time: Loading..</div>')
	addElement(panel, '<div class="server-info-entry" id="new-day-in">New Day In: Loading..</div>')
	addElement(panel, '<br>')
	addElement(panel, '<div class="server-info-entry" id="storm">⚡ Storm: Loading..</div>')
	addElement(panel, '<div class="server-info-entry" id="thunder">⛈️ Thunder: Loading..</div>')

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
	const vpRemaining = info.voteParty.numRemaining
	const { numOnlinePlayers, numOnlineNomads } = info.stats
	const { newDayTime, serverTimeOfDay } = info.timestamps

	// Server Time
	const hours = Math.floor(serverTimeOfDay / 3600)
	const minutes = Math.floor((serverTimeOfDay % 3600) / 60)

	const displayHour = hours % 12 || 12
	const displayMin = minutes.toString().padStart(2, '0')
	const timeStr = `${displayHour}:${displayMin} ${hours >= 12 ? 'PM' : 'AM'}`

	// New Day In
	let delta = newDayTime - serverTimeOfDay
	if (delta < 0) delta += 86_400 // 24hr
	const newDayHr = Math.floor(delta / 3600)
	const newDayMin = Math.floor((delta % 3600) / 60)

	element.querySelector("#vote-party").innerHTML = serverInfoEntry(`Votes until VP`, vpRemaining > 0 ? vpRemaining : 0)
	element.querySelector("#online-players-count").innerHTML = serverInfoEntry(`Online Players`, numOnlinePlayers || 0)
	element.querySelector("#online-nomads-count").innerHTML = serverInfoEntry(`Online Townless`, numOnlineNomads || 0)
	element.querySelector("#server-time").innerHTML = serverInfoEntry(`Server Time`, timeStr)
	element.querySelector("#new-day-in").innerHTML = serverInfoEntry(`New Day In`, `${newDayHr}hrs ${newDayMin}m`)
	element.querySelector("#storm").innerHTML = serverInfoEntry(`⚡ Storm`, info.status.hasStorm ? 'Yes' : 'No')
	element.querySelector("#thunder").innerHTML = serverInfoEntry(`⛈️ Thunder`, info.status.isThundering ? 'Yes' : 'No')
}

/** @param {HTMLElement} parent - The "leaflet-top leaflet-left" element. */
function addMainMenu(parent) {
	const sidebar = addElement(parent, htmlCode.sidebar)
	addLocateMenu(sidebar) // Locator button and input box

	//#region Archive search and date input
	const archiveContainer = addElement(sidebar, htmlCode.sidebarOption, '.sidebar-option', true)[1]
	const archiveButton = addElement(archiveContainer, htmlCode.buttons.searchArchive)
	const archiveInput = addElement(archiveContainer, htmlCode.archiveInput)
	
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
	const switchMapModeButton = addElement(sidebar, htmlCode.buttons.switchMapMode)
	switchMapModeButton.addEventListener('click', _ => switchMapMode(curMapMode))

	// Options button and checkboxes
	addOptions(sidebar, curMapMode)

	// Current map mode label
	const currentMapModeLabel = addElement(sidebar, htmlCode.currentMapModeLabel)
	currentMapModeLabel.textContent = currentMapModeLabel.textContent.replace('{currentMapMode}', curMapMode)

	return sidebar
}

/** 
 * @param {HTMLElement} sidebar 
 * @param {MapMode} curMapMode 
*/
function addOptions(sidebar, curMapMode) {
	const optionsButton = addElement(sidebar, htmlCode.buttons.options)
	const optionsMenu = addElement(sidebar, htmlCode.options.menu)
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
	const option = addElement(menu, htmlCode.options.option, '.option', true)[index]
	option.insertAdjacentHTML('beforeend', htmlCode.options.label
		.replace('{option}', optionId)
		.replace('{optionText}', optionText))
	
	// Initialize checkbox state
	/** @type {HTMLInputElement} */
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
function toggleDarkened(boxTicked, percentage = 45) {
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

	const queryBody = { query: [nation], template: { capital: true } }
	const data = await postJSON(`${OAPI_BASE}/${CURRENT_MAP}/nations`, queryBody)
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

	const queryBody = { query: [resident], template: { town: true } }
	const data = await postJSON(`${OAPI_BASE}/${CURRENT_MAP}/players`, queryBody)
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
	const queryBody = { query: [town], template: { coordinates: true } }
	const data = await postJSON(`${OAPI_BASE}/${CURRENT_MAP}/towns`, queryBody)
	if (data == false || data == undefined) return false
	if (data == null) return null

	const spawn = data[0].coordinates.spawn
	return { x: Math.round(spawn.x), z: Math.round(spawn.z) }
}
//#endregion