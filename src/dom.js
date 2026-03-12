/** ANYTHING RELATED TO UI ELEMENTS OR DOM MANIPULATION BELONGS IN THIS FILE */
console.log('emcdynmapplus: loaded dom')

// TODO: Add sliders under a "Tile Filters" section and bind these variables to their respective values.
const BRIGHTNESS_PERCENTAGE = 60
const CONTRAST_PERCENTAGE = 105
const SATURATE_PERCENTAGE = 95
const getTilePaneFilter = () => /** @type {const} */ (
	`brightness(${BRIGHTNESS_PERCENTAGE}%) contrast(${CONTRAST_PERCENTAGE}%) saturate(${SATURATE_PERCENTAGE}%)`
)

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
	nationClaimsTextInput: '<input type="text" id="nation-text-entry{index}" placeholder="Enter nation name..."></input>',
	nationClaimsTitlebar:
		'<div id="nation-claims-titlebar">' +
		'<p>Nation Claims Customizer</p>' +
		'<div class="leaflet-control-layers link leaflet-control"><a href=""><img class="crisp-edges" src="images/clear.png"></a></div>' +
		'</div>',
	serverInfo: '<div class="leaflet-control-layers leaflet-control" id="server-info"></div>',
    sidebar: '<div class="leaflet-control-layers leaflet-control" id="sidebar"></div>',
    sidebarOption: '<div class="sidebar-option"></div>',
    locateInput: '<input class="sidebar-input" id="locate-input" placeholder="London">',
    locateSelect: '<select class="sidebar-button" id="locate-select"><option>Town</option><option>Nation</option><option>Resident</option></select>',
    archiveInput: `<input class="sidebar-input" id="archive-input" type="date" min="${ARCHIVE_DATE.MIN}" max="${ARCHIVE_DATE.MAX}">`,
    currentMapModeLabel: '<div class="sidebar-option" id="current-map-mode-label">Map Mode: {currentMapMode}</div>',
    alertBox: '<div id="alert"><p id="alert-message">{message}</p><button id="alert-close">Dismiss</button></div>',
	/** Inserted into document <head> */
	interFont: `<link rel="preconnect" href="https://fonts.googleapis.com">
		<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
		<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap">
	`,
	darkMode: `<style id="dark-mode">
		.leaflet-control, .sidebar-input, #alert,
		.sidebar-button, .leaflet-bar > a, .leaflet-tooltip-top,
		.leaflet-popup-content-wrapper, .leaflet-popup-tip,
		.leaflet-bar > a.leaflet-disabled {
			background: #131313d4 !important;
			color: #dedede;
		}
		div.leaflet-control-layers.link img {
			filter: invert(1);
		}
		</style>
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
 * @param {string} message - The important text to show inside the alert box.
 * @param {number} timeout - The time (in sec) until the alert box is auto closed. null = manual dismiss
 */
function showAlert(message, timeout = null) {
	let alert = document.querySelector('#alert')
	if (!alert) {
		document.body.insertAdjacentHTML('beforeend', htmlCode.alertBox.replace('{message}', message))
		alert = document.querySelector('#alert')

		const alertClose = alert.querySelector('#alert-close')
		alertClose.addEventListener('click', e => e.target.parentElement.remove())
	} else {
		alert.querySelector('#alert-message').textContent = message
	}

	if (!timeout) return
	setTimeout(() => {
		const alert = document.querySelector('#alert')
		if (alert) alert.remove()
	}, timeout*1000)
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
 * @param {Element} parent
 * @param {string} html
 * @param {Object} [options]
 * @param {string} [options.selector] - optional query selector *inside* inserted nodes. null = self
 * @param {boolean} [options.all=false] - return all matching nodes
 * @param {boolean} [options.wrap=false] - wrap HTML in a container div before appending
 */
function appendHTML(parent, html, options = { selector: null, all: false, wrap: false }) {
	const { selector, all, wrap } = options
	
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

async function insertScreenshotBtn() {
	const linkBtn = await waitForElement(".leaflet-control-layers.link")
	const linkBtnCloned = linkBtn?.cloneNode(true)
	linkBtnCloned.className = 'leaflet-control-layers link screenshot leaflet-control'

	const screenshotBtn = linkBtn?.parentElement?.insertBefore(linkBtnCloned, linkBtn.parentElement.children[0])
	screenshotBtn?.firstChild.setAttribute("href", "")
	screenshotBtn?.addEventListener('click', async e => {
		e.preventDefault() // stop blank href from refreshing as we are adding our own button behaviour

		try {
			const canvas = await screenshotViewport()
			const blob = await canvas.convertToBlob({ type: 'image/png', quality: 1 })
			await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
			
			showAlert('Screenshot successful. Copied to clipboard!', 5)
		} catch (e) {
			console.error(e)
			showAlert('Failed to screenshot/copy to clipboard. Check the console.')
		}
	})
}

/**
 * Temporarily blocks mouse/keyboard interaction while running a function.
 * @param {() => Promise<any>} fn Async function to run while blocked
 * @returns {Promise<any>} Resolves with the callback result
 */
const withInteractionBlocked = async (fn) => {
	const blocker = document.createElement('div')
	blocker.style.position = 'fixed'
	blocker.style.top = '0'
	blocker.style.left = '0'
	blocker.style.width = '100vw'
	blocker.style.height = '100vh'
	blocker.style.zIndex = '999999'
	blocker.style.cursor = 'wait'
	document.body.appendChild(blocker)

	try {
		return await fn()
	} finally {
		blocker.remove()
	}
}

/**
 * Waits until the Leaflet map stops being panned or updated.
 * Resolves once DOM is stable for 50ms.
 */
const waitForStableViewport = () => new Promise(resolve => {
	const pane = document.querySelector('.leaflet-map-pane')
	if (!pane) return resolve()
	
	let timer
	const observer = new MutationObserver(() => {
		clearTimeout(timer)
		timer = setTimeout(() => {
			observer.disconnect()
			resolve()
		}, 50)
	})

	observer.observe(pane, { attributes: true, childList: true, subtree: true, characterData: true })
})

const queryTileElements = () => document.querySelectorAll(".leaflet-tile-pane .leaflet-layer img.leaflet-tile")
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const nextFrame = () => new Promise(r => requestAnimationFrame(r))

/** @returns {Promise<OffscreenCanvas>} */
const screenshotViewport = async () => {
	await withInteractionBlocked(async () => {
		showAlert("Waiting for viewport to stabilize...")
		await waitForStableViewport() // wait until map is no longer being panned

		showAlert("Screenshotting viewport...", 2)
		for (let i = 0; i < 20; i++) {
			await nextFrame()
		}
	})

	const tileElements = queryTileElements()
	if (!tileElements.length) throw new Error('No tiles found')

	/** @type {Array<HTMLImageElement>} */
	const tiles = Array.from(tileElements).filter(img => {
		if (!img.parentElement) return false
		
		const style = getComputedStyle(img.parentElement)
		const scale = parseFloat(style.transform.match(/scale\(([^)]+)\)/)?.[1] || '1')
		
		return scale >= 1 // only include tiles with decent resolution
	})

	// wait for images to fully decode and finish loading
	await Promise.all(tiles.map(img => img.decode().catch(() => {})))

	const vw = window.innerWidth
	const vh = window.innerHeight
	const canvas = new OffscreenCanvas(vw, vh)
	
	const ctx = canvas.getContext('2d')
	ctx.filter = getTilePaneFilter()

	// draw tiles relative to viewport
	for (const img of tiles) {
		const rect = img.getBoundingClientRect()

		// skip tiles fully outside viewport
		if (rect.right <= 0 || rect.bottom <= 0) continue
		if (rect.left >= vw || rect.top >= vh) continue

		ctx.drawImage(img, rect.left, rect.top, rect.width, rect.height)
	}

	ctx.filter = 'none'

	const overlay = document.querySelector('.leaflet-overlay-pane canvas.leaflet-zoom-animated')
	if (!overlay) throw new Error('Cannot draw markers onto output image due to missing overlay pane element!')

	//#region draw overlay canvas onto new canvas
	const rect = overlay.getBoundingClientRect()
	const x = Math.max(rect.left, 0)
	const y = Math.max(rect.top, 0)
	const width = Math.min(rect.right, vw) - x
	const height = Math.min(rect.bottom, vh) - y
	
	if (width > 0 && height > 0) {
		const scaleX = overlay.width / rect.width
		const scaleY = overlay.height / rect.height
		
		const dx = (x - rect.left) * scaleX
		const dy = (y - rect.top) * scaleY
		
		ctx.drawImage(overlay, dx, dy, width * scaleX, height * scaleY, x, y, width, height)
	}
	//#endregion

	return canvas
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
	const bottomLeft = document.querySelector(".leaflet-bottom.leaflet-left")
	if (link || coordinates) {
		// Create a wrapper div
		const wrapper = document.createElement('div')
		wrapper.id = 'coords-container'

		// Move elements into wrapper
		if (link) wrapper.appendChild(link)
		if (coordinates) wrapper.appendChild(coordinates)

		bottomLeft.appendChild(wrapper)
	}

	const zoomControl = await waitForElement('.leaflet-control-zoom')
	if (zoomControl) bottomLeft.insertBefore(zoomControl, bottomLeft.firstChild)

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

/** 
 * Inserts the claim color customizer only if the active map mode matches mapMode.
 * @param {string} mapMode - The name of the map mode required to insert the claims panel.
 * @returns {Promise<Element | null>} The "#nation-claims" element. 
 */
function tryInsertNationClaimsPanel(mapMode) {
	const mode = localStorage['emcdynmapplus-mapmode']
	if (mode != mapMode) return null

	return waitForElement('.leaflet-control-container').then(el => {
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

const MAX_CLAIM_COLOUR_INPUTS = 300

/** @param {HTMLElement} parent - The "leaflet-bottom leaflet-right" element. */
function addNationClaimsPanel(parent) {
	/** @type {HTMLElement} */
	const panel = addElement(parent, htmlCode.nationClaims)
	panel.addEventListener('wheel', e => e.stopPropagation()) // stop squaremap overtaking scroll, we need to scroll the inputs

	/** @type {HTMLElement} */
	const titlebar = addElement(panel, htmlCode.nationClaimsTitlebar, '#nation-claims-titlebar')
	const toggleShowBtn = titlebar.querySelector('a')
	const btnImg = toggleShowBtn.querySelector('img')
	toggleShowBtn.addEventListener('click', e => {
		e.preventDefault()

		const contentContainer = panel.querySelector('#nation-claims-content')
		contentContainer.style.display = contentContainer.style.display == 'none' ? '' : 'none'
		btnImg.classList.toggle('active') // toggles the appropriate show or hide icon
	})

	// Container for everything except the titlebar. This container is hidden by clicking the eye icon.
	/** @type {HTMLElement} */
	const contentContainer = addElement(panel, '<div id="nation-claims-content"></div>')
	contentContainer.style.display = 'none'

	/** @type {HTMLElement} */
	const entriesContainer = addElement(contentContainer, '<div id="nation-claims-entry-container"></div>')
	
	for (let i = 1; i <= MAX_CLAIM_COLOUR_INPUTS; i++) {
		const colInput = htmlCode.nationClaimsColorInput.replace('{index}', i) 
		const txtInput = htmlCode.nationClaimsTextInput.replace('{index}', i)

		const id = `nation-claims-entry${i}`
		addElement(entriesContainer, `<div class="nation-claims-entry" id="${id}">${colInput}${txtInput}</div>`)
	}

	const optDiv1 = addElement(contentContainer, '<div class="nation-claims-checkbox-option"></div>')
	const optDiv2 = addElement(contentContainer, '<div class="nation-claims-checkbox-option"></div>')

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
	const div = appendHTML(contentContainer, '<div id="nation-claims-btn-container"></div>')

	/** @type {HTMLElement} */
	const applyBtn = appendHTML(div, '<button class="sidebar-button" id="nation-claims-apply">Apply</button>')
	applyBtn.addEventListener('click', () => {
		const colorInputs = entriesContainer.querySelectorAll('[id^="nation-color-entry"]')
		const textInputs  = entriesContainer.querySelectorAll('[id^="nation-text-entry"]')

		const entries = Array.from({ length: MAX_CLAIM_COLOUR_INPUTS }, (_, i) => ({
			color: colorInputs[i]?.value ?? null,
			input: textInputs[i]?.value ?? null,
		}))

		localStorage['emcdynmapplus-nation-claims-info'] = JSON.stringify(entries)
		location.reload()
	})

	/** @type {HTMLElement} */
	const resetAllBtn = appendHTML(div, '<button class="sidebar-button" id="nation-claims-reset-all">Reset All</button>')
	resetAllBtn.addEventListener('click', () => {
		const entries = Array.from({ length: MAX_CLAIM_COLOUR_INPUTS }, () => ({ color: null, input: null }))
		localStorage['emcdynmapplus-nation-claims-info'] = JSON.stringify(entries)
		loadNationClaims(panel)
		showAlert("Set all nation claim inputs to default.")
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
 */
function toggleDarkened(boxTicked) {
	const element = document.querySelector('.leaflet-tile-pane')
	if (!element) return showAlert('Failed to toggle brightness. Cannot apply filter to non-existent tile pane.')

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
	document.head.insertAdjacentHTML('beforeend', htmlCode.interFont)
	// other stylesheet html links ... 
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

	if (!coords) return showAlert(`Could not find town/capital with name '${townName}'.`)
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

	if (!capitalName) return showAlert('Searched nation could not be found.')
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

	if (!townName) return showAlert('Searched resident could not be found.')
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