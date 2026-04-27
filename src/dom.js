/** ANY UI CODE OR DOM MANIPULATION NOT RELATING TO THE EXTENSION MENU BELONGS IN THIS FILE */
//console.log('emcdynmapplus: loaded dom')

const ARCHIVE_DATE = {
	MIN: "2022-05-01",
	MAX: new Date().toLocaleDateString()
}

const MAX_NATION_CLAIM_ENTRIES = 300

const SCROLL_BASE_ZOOM 	= 90
const SCROLL_LINE_DELTA = 30  // 1 scroll line = ~30 deltaY in windows
const SCROLL_THRESHOLD 	= 5	  // increase zoom by this many scroll lines

// TODO: Add sliders under a "Tile Filters" section and bind these variables to their respective values.
const BRIGHTNESS_PERCENTAGE = 65
const CONTRAST_PERCENTAGE = 102
const SATURATE_PERCENTAGE = 97
const getTilePaneFilter = () => /** @type {const} */ (
	`brightness(${BRIGHTNESS_PERCENTAGE}%) contrast(${CONTRAST_PERCENTAGE}%) saturate(${SATURATE_PERCENTAGE}%)`
)

const INSERTABLE_HTML = /** @type {const} */ ({
	// Used in dom.js
    buttons: {
        locate: '<button class="menu-button-option" id="locate-button">Locate</button>',
        searchArchive: '<button class="menu-button-option" id="archive-button">Search Archive</button>',
        //switchMapMode: '<button class="menu-button-option" id="switch-map-mode">Switch Map Mode</button>',
        options: '<button class="menu-button-option" id="options-button">Show Options</button>'
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
	menuHeader: `<div id="menu-header" class="menu-header">EarthMC Dynmap+<span id="menu-arrow">▼</span></div>`,
	menu: '<div class="leaflet-control-layers leaflet-control" id="menu"></div>',
    menuOption: '<div class="menu-option"></div>',
    locateMenu: '<div id="locate-menu"></div>',
	locateInput: '<input class="menu-input-option" id="locate-input" placeholder="London">',
    locateSelect: '<select id="locate-select"><option>Town</option><option>Nation</option><option>Resident</option></select>',
    archiveMenu: '<div id="archive-menu"></div>',
    archiveInput: `<input class="menu-input-option" id="archive-input" type="date" min="${ARCHIVE_DATE.MIN}" max="${ARCHIVE_DATE.MAX}">`,
	mapMode: {
		selector: '<div class="leaflet-control-layers leaflet-control" id="map-mode-selector"></div>',
		optionContainer: '<div id="map-mode-option-container"></div>',
		btnOption: '<button class="map-mode-btn-option"></button>',
		currentModeLabel: '<div id="current-map-mode-label">Map Mode: null</div>',
	},
    followingPlayer: '<h1 id="following-warning">Stop following this player by clicking on the map.</h1>',
    alertBox: '<div id="alert"><p id="alert-message">{message}</p><button id="alert-close">Dismiss</button></div>',
	// Used in main.js
    playerLookup: '<div class="leaflet-control-layers leaflet-control" id="player-lookup"></div>',
    playerLookupLoading: '<div class="leaflet-control-layers leaflet-control" id="player-lookup-loading">Loading...</button>',
    residentClickable: '<span class="resident-clickable">{player}</span>',
    residentList: '<span class="resident-list">\t{list}</span>',
    scrollableResidentList: '<div class="resident-list" id="scrollable-list">\t{list}</div>',
    partOfLabel: '<span id="part-of-label">Part of <b>{allianceList}</b></span>',
    alertMsg: '<div class="message" id="alert"><p id="alert-message">{message}</p></div>',
	// Inserted into document <head>
	interFont: `<link rel="preconnect" href="https://fonts.googleapis.com">
		<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
		<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap">
	`,
	darkMode: `<style id="dark-mode">
		.leaflet-control, .menu-input-option, #locate-select, #alert,
		.menu-button-option, .leaflet-bar > a, .leaflet-tooltip-top,
		.leaflet-popup-content-wrapper, .leaflet-popup-tip,
		.leaflet-bar > a.leaflet-disabled {
			background: #131313d4 !important;
			color: #e0e0e0;
		}
		div.leaflet-control-layers.link img {
			filter: invert(1);
		}
		.map-mode-btn-option {
			background: black;
			border: 2px dashed white;
		}
		.map-mode-btn-option:hover {
			border: 3px dashed var(--yellow-colour);
			background: black;
		}
		</style>
	`,
})

let alertTimeout = null

/**
 * Shows an alert message in a box at the center of the screen.
 * @param {string} message - The important text to show inside the alert box.
 * @param {number} timeout - The time (in sec) until the alert box is auto closed. null = manual dismiss
 */
function showAlert(message, timeout = null) {
	let alert = document.querySelector('#alert')
	if (!alert) {
		alert = addElement(document.body, INSERTABLE_HTML.alertBox.replace('{message}', message))
		alert.querySelector('#alert-close').addEventListener('click', () => {
			clearTimeout(alertTimeout)
			alert.remove()
		})
	} else alert.querySelector('#alert-message').textContent = message

	clearTimeout(alertTimeout)
	if (timeout) alertTimeout = setTimeout(() => alert.remove(), timeout*1000)

	return alert
}

/**
 * Adds element to parent and uses selector to query select an element on parent.
 * @param {HTMLElement} parent
 * @param {string} elementHTML
 * @param {string} selector - optional query selector *inside* parent. null = self
 * @param {boolean} all - return all matching nodes
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
 * Calls `callback` whenever the element's href changes.
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

	const displayServerInfo = localStorage['emcdynmapplus-serverinfo'] == 'true' ? true : false
	waitForElement('#server-info').then(_ => toggleServerInfo(displayServerInfo))

	const displayPlayerList = localStorage['emcdynmapplus-playerlist'] == 'true' ? true : false
	waitForElement('#players').then(_ => togglePlayerList(displayPlayerList))

	// Initialize date input from stored date. 20260801 -> 2026-08-01
	const archiveDate = localStorage['emcdynmapplus-archive-date']
	if (archiveDate) {
		const formattedDate = archiveDate.slice(0, 4) + '-' + archiveDate.slice(4, 6) + '-' + archiveDate.slice(6, 8)
		waitForElement('#archive-input').then(dateInputEl => dateInputEl.value = formattedDate)
	}

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
			const canvas = await withInteractionBlocked(screenshotViewport)
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
 * Temporarily blocks mouse/keyboard interaction while running `fn`.
 * @template T
 * @param {() => Promise<T>} fn - Async function to run while blocked.
 * @returns {Promise<T>} Resolves with whatever the callback returns.
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

/** Waits until the Leaflet map stops being panned. */
const waitForStableViewport = () => new Promise(resolve => {
	const pane = document.querySelector('.leaflet-map-pane')
	if (!pane) return resolve()
	if (!pane.classList.contains('leaflet-pan-anim')) return resolve() // already stable

	const observer = new MutationObserver(() => {
		if (!pane.classList.contains('leaflet-pan-anim')) {
			observer.disconnect()
			resolve()
		}
	})

	observer.observe(pane, { attributes: true, attributeFilter: ['class'] })
})

/** @param {HTMLElement} el */
const waitForTransform = (el) => new Promise(resolve => {
	let timer
	let last = getComputedStyle(el).transform
	const observer = new MutationObserver(() => {
		const current = getComputedStyle(el).transform
		if (current === last) return
		
		clearTimeout(timer)
		timer = setTimeout(() => {
			observer.disconnect()
			resolve()
		}, 50)

		last = current
	})

	observer.observe(el, { attributes: true, attributeFilter: ['style'] })
	timer = setTimeout(() => {
		observer.disconnect() // if nothing changes at all, don't hang forever
		resolve()
	}, 100)
})

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
			showAlert('Updated URL with current camera coordinates. Next refresh will navigate there automatically.', 4)
		}
	})

	// move the +- zoom control buttons to the bottom instead of top
    // and make sure the link and coordinates buttons align with it
	const bottomLeft = document.querySelector(".leaflet-bottom.leaflet-left")
	if (link || coordinates) {
		const wrapper = document.createElement('div')
		wrapper.id = 'coords-container'
 		
		// place link btn and coords in same div under bottom left panel
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

	// Remove the sidebar that contains the list of worlds
	if (CURRENT_MAP == 'nostra') waitForElement('#sidebar').then(el => el?.remove())
}

/** 
 * Inserts the claim color customizer only if the active map mode matches mapMode.
 * @param {MapMode} mapMode - The name of the map mode required to insert the claims panel.
 * @returns {Promise<Element | null>} The "#nation-claims" element. 
 */
function tryInsertNationClaimsPanel(mapMode) {
	const mode = currentMapMode()
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

/** @returns {Promise<Element | null>} The "#menu" element. */
function insertExtensionMenu() {
    return waitForElement('.leaflet-top.leaflet-left').then(el => {
        disablePanAndZoom(el)
        return addExtensionMenu(el)
    })
}

/** @returns {Promise<Element | null>} The "#map-mode-selector" element. */
function insertMapModeSelector() {
	return waitForElement('.leaflet-control-container').then(el => {
		disablePanAndZoom(el)
		return addMapModeSelector(el)
	})
}

/** @param {HTMLElement} element - The element to prevent dblckick and mousedown events on. */
function disablePanAndZoom(element) {
	// Prevents panning the map when on this element by
	// stopping the mouse event from propogating to Leaflet.
	element.addEventListener('mousedown', e => e.stopPropagation())

	// blocks the map (Leaflet) from zooming when 
	// double clicking in the extension menu.
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
	const panel = addElement(parent, INSERTABLE_HTML.nationClaims)
	panel.addEventListener('wheel', e => e.stopPropagation()) // stop squaremap overtaking scroll, we need to scroll the inputs

	/** @type {HTMLElement} */
	const titlebar = addElement(panel, INSERTABLE_HTML.nationClaimsTitlebar, '#nation-claims-titlebar')
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
	
	let html = ''
	for (let i = 1; i <= MAX_NATION_CLAIM_ENTRIES; i++) {
		const colInput = INSERTABLE_HTML.nationClaimsColorInput.replace('{index}', i) 
		const txtInput = INSERTABLE_HTML.nationClaimsTextInput.replace('{index}', i)
		html += `<div class="nation-claims-entry" id="nation-claims-entry${i}">${colInput}${txtInput}</div>`
	}
	addElement(entriesContainer, html)

	const optDiv1 = addElement(contentContainer, '<div class="nation-claims-checkbox-option"></div>')
	const optDiv2 = addElement(contentContainer, '<div class="nation-claims-checkbox-option"></div>')

	/** @type {HTMLElement} */
	const showExcludedCheckbox = appendHTML(optDiv1, 
		INSERTABLE_HTML.options.checkbox.replace('{option}', 'show-excluded') + 
		INSERTABLE_HTML.options.label.replace('{option}', 'show-excluded').replace('{optionText}', 'Show irrelevant towns')
	)
	showExcludedCheckbox.checked = localStorage['emcdynmapplus-nation-claims-show-excluded'] == 'true' ? true : false
	showExcludedCheckbox.addEventListener('change', e =>
		localStorage['emcdynmapplus-nation-claims-show-excluded'] = e.target.checked
	)

	/** @type {HTMLElement} */
	const useOpaqueCheckbox = appendHTML(optDiv2,
		INSERTABLE_HTML.options.checkbox.replace('{option}', 'use-opaque-colors') + 
		INSERTABLE_HTML.options.label.replace('{option}', 'use-opaque-colors').replace('{optionText}', 'Use opaque colors')
	)
	useOpaqueCheckbox.checked = localStorage['emcdynmapplus-nation-claims-opaque-colors'] == 'true' ? true : false
	useOpaqueCheckbox.addEventListener('change', e =>
		localStorage['emcdynmapplus-nation-claims-opaque-colors'] = e.target.checked
	)

	/** @type {HTMLElement} */
	const div = appendHTML(contentContainer, '<div id="nation-claims-btn-container"></div>')

	/** @type {HTMLElement} */
	const applyBtn = appendHTML(div, '<button class="menu-button-option" id="nation-claims-apply">Apply</button>')
	applyBtn.addEventListener('click', () => {
		const colorInputs = entriesContainer.querySelectorAll('[id^="nation-color-entry"]')
		const textInputs  = entriesContainer.querySelectorAll('[id^="nation-text-entry"]')
		const entries = Array.from({ length: MAX_NATION_CLAIM_ENTRIES }, (_, i) => ({
			color: colorInputs[i]?.value ?? null,
			input: textInputs[i]?.value ?? null,
		}))

		localStorage['emcdynmapplus-nation-claims-info'] = JSON.stringify(entries)
		location.reload()
	})

	/** @type {HTMLElement} */
	const resetAllBtn = appendHTML(div, '<button class="menu-button-option" id="nation-claims-reset-all">Reset All</button>')
	resetAllBtn.addEventListener('click', () => {
		const entries = Array.from({ length: MAX_NATION_CLAIM_ENTRIES }, () => ({ color: null, input: null }))
		localStorage['emcdynmapplus-nation-claims-info'] = JSON.stringify(entries)
		loadNationClaims(panel)
		showAlert("Set all nation claim inputs to default.", 2)
	})

	return panel
}

/** @param {HTMLElement} parent - The "leaflet-top leaflet-right" element. */
function addServerInfoPanel(parent) {
	const panel = addElement(parent, INSERTABLE_HTML.serverInfo)
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

/** @param {number} deltaY */
function triggerScrollEvent(deltaY) {
    // Calculate how many sets of SCROLL_THRESHOLD lines the user scrolled
    const zoomMultiplier = Math.floor(Math.abs(deltaY) / (SCROLL_LINE_DELTA * SCROLL_THRESHOLD))
    const pxPerZoomLevel = SCROLL_BASE_ZOOM + (zoomMultiplier * 30)

	const eventData = { detail: { pxPerZoomLevel: deltaY < 0 ? pxPerZoomLevel : -pxPerZoomLevel } }
    document.dispatchEvent(new CustomEvent('EMCDYNMAPPLUS_ADJUST_SCROLL', eventData))
}

const SERVERINFO_INTERVAL = 5*1000
let serverInfoScheduler = null

/** @param {HTMLElement} element - The "#server-info" element. */
async function updateServerInfo(element) {
	const info = await fetchServerInfo()
	if (info) renderServerInfo(element, info)

	// schedule next only if still enabled
	const enabled = localStorage['emcdynmapplus-serverinfo'] === 'true' ? true : false
	if (!enabled) serverInfoScheduler = null
	else serverInfoScheduler = setTimeout(() => updateServerInfo(element), SERVERINFO_INTERVAL)
}

async function insertPlayerList() {
	waitForElement('#players').then(el => {
		el?.classList.add('leaflet-control-layers')
		el?.classList.add('leaflet-control')

		const topRight = document.querySelector('.leaflet-top.leaflet-right')
		topRight.appendChild(el)

		el.addEventListener('wheel', e => e.stopImmediatePropagation())
	})
	
	addElement(document.body, INSERTABLE_HTML.followingPlayer)
	followWarningTick()
}

function followWarningTick() {
    const following = document.querySelector('.following')?.isConnected
    document.querySelector('#following-warning').style.display = following ? 'unset' : 'none'
    requestAnimationFrame(followWarningTick)
}