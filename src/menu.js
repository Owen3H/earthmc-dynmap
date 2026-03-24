/** ANY CODE RELATING TO THE MAIN ONSCREEN EXTENSION MENU GOES HERE */
//console.log('emcdynmapplus: loaded menu')

// TODO: Use Custom Element Registry and convert the main menu into one.

const MAP_MODE_METADATA = [
	{
		value: 'meganations',
		label: 'Mega Nations',
		description: 'Show mega-alliance colors directly on town claims.',
	},
	{
		value: 'alliances',
		label: 'Alliances',
		description: 'Color towns by alliance ownership with clean borders.',
	},
	{
		value: 'nationclaims',
		label: 'Nation Claims',
		description: 'Load the nation-claims customizer for manual color maps.',
	},
	{
		value: 'overclaim',
		label: 'Overclaim',
		description: 'Highlight towns that exceed their current claim limits.',
	},
	{
		value: 'default',
		label: 'Live Map',
		description: 'Use the base map styling with only the shared enhancements.',
	},
	{
		value: 'archive',
		label: 'Archive',
		description: 'Load the nearest historical snapshot from the Wayback archive.',
	},
]

const getMapModeMeta = mode => MAP_MODE_METADATA.find(option => option.value === mode) || MAP_MODE_METADATA[0]
const formatMapModeLabel = mode => `Map Mode: ${mode}`
const SIDEBAR_EXPANDED_KEY = 'emcdynmapplus-sidebar-expanded'

/** @param {HTMLElement} parent - The "leaflet-top leaflet-left" element. */
function addMainMenu(parent) {
	const existingSidebar = parent.querySelector('#sidebar')
	if (existingSidebar) return existingSidebar

	const curMapMode = currentMapMode()
	const isExpanded = localStorage[SIDEBAR_EXPANDED_KEY] == 'true'
	const sidebar = addElement(parent, createElement('details', {
		id: 'sidebar',
		className: 'leaflet-control-layers leaflet-control',
		attrs: {
			'data-active-mode': curMapMode,
			...(isExpanded ? { open: '' } : {}),
		},
	}))
	sidebar.addEventListener('toggle', () => {
		localStorage[SIDEBAR_EXPANDED_KEY] = String(sidebar.open)
	})
	addSidebarSummary(sidebar, curMapMode)

	const sidebarContent = addElement(sidebar, createElement('div', { id: 'sidebar-content' }))
	addSidebarHeader(sidebarContent, curMapMode)
	addLocateMenu(sidebarContent) // Locator button and input box
	addMapModeSection(sidebarContent, curMapMode)

	return sidebar
}

/**
 * @param {HTMLElement} sidebar
 * @param {MapMode | "archive"} curMapMode
 */
function addSidebarSummary(sidebar, curMapMode) {
	const modeMeta = getMapModeMeta(curMapMode)
	return addElement(sidebar, createElement('summary', {
		id: 'sidebar-toggle',
	}, [
		createElement('span', { className: 'sidebar-summary-copy' }, [
			createElement('span', {
				className: 'sidebar-summary-eyebrow',
				text: 'Dynmap+',
			}),
			createElement('strong', {
				className: 'sidebar-summary-title',
				text: 'Map Toolkit',
			}),
			createElement('span', {
				id: 'sidebar-summary-mode',
				className: 'sidebar-summary-mode',
				text: modeMeta.label,
			}),
		]),
		createElement('span', {
			className: 'sidebar-summary-indicator',
			text: 'v',
		}),
	]))
}

/**
 * @param {HTMLElement} sidebar
 * @param {MapMode | "archive"} curMapMode
 */
function addSidebarHeader(sidebar, curMapMode) {
	const header = addElement(sidebar, createElement('div', { className: 'sidebar-header' }))
	addElement(header, createElement('div', {
		className: 'sidebar-eyebrow',
		text: 'EarthMC Dynmap+',
	}))
	addElement(header, createElement('h2', {
		className: 'sidebar-title',
		text: 'Map Toolkit',
	}))

	const status = addElement(header, createElement('div', { className: 'sidebar-status-row' }))
	addElement(status, createElement('div', {
		id: 'current-map-mode-label',
		className: 'sidebar-mode-pill',
		text: formatMapModeLabel(curMapMode),
	}))
}

/**
 * @param {HTMLElement} parent
 * @param {string} title
 * @param {string} description
 */
function addSidebarSection(parent, title, description) {
	const section = addElement(parent, createElement('section', { className: 'sidebar-section' }))
	const header = addElement(section, createElement('div', { className: 'sidebar-section-header' }))
	addElement(header, createElement('h3', {
		className: 'sidebar-section-title',
		text: title,
	}))
	addElement(header, createElement('p', {
		className: 'sidebar-section-copy',
		text: description,
	}))
	return section
}

/**
 * @param {HTMLElement} sidebar
 * @param {MapMode | "archive"} curMapMode
 */
function addMapModeSection(sidebar, curMapMode) {
	const section = addSidebarSection(
		sidebar,
		'Map View',
		'Pick an overlay directly.'
	)
	section.id = 'map-mode-section'

	addElement(section, createElement('label', {
		className: 'sidebar-field-label',
		htmlFor: 'map-mode-select',
		text: 'View mode',
	}))
	const modeSelect = addElement(section, createElement('select', {
		id: 'map-mode-select',
		className: 'sidebar-input sidebar-select',
	}, MAP_MODE_METADATA.map(mode => createElement('option', {
		value: mode.value,
		text: mode.label,
	}))))
	modeSelect.value = curMapMode

	const modeDescription = addElement(section, createElement('p', {
		id: 'map-mode-description',
		className: 'sidebar-help',
		text: getMapModeMeta(curMapMode).description,
	}))

	const archiveField = addElement(section, createElement('div', {
		id: 'archive-date-group',
		className: 'sidebar-field-group',
	}))
	addElement(archiveField, createElement('label', {
		className: 'sidebar-field-label',
		htmlFor: 'archive-input',
		text: 'Archive date',
	}))
	const archiveInput = addElement(archiveField, createElement('input', {
		id: 'archive-input',
		className: 'sidebar-input',
		type: 'date',
		attrs: {
			min: ARCHIVE_DATE.MIN,
			max: ARCHIVE_DATE.MAX,
		},
	}))

	const actions = addElement(section, createElement('div', { className: 'sidebar-action-row' }))
	const switchMapModeButton = addElement(actions, createElement('button', {
		id: 'switch-map-mode',
		className: 'sidebar-button sidebar-button-primary',
		text: 'Apply Selected View',
	}))
	const archiveButton = addElement(actions, createElement('button', {
		id: 'archive-button',
		className: 'sidebar-button sidebar-button-secondary',
		text: 'Open Archive',
	}))

	const syncModeUI = () => {
		const selectedMode = modeSelect.value
		const selectedMeta = getMapModeMeta(selectedMode)
		modeDescription.textContent = selectedMeta.description
		section.setAttribute('data-archive-selected', String(selectedMode === 'archive'))
		switchMapModeButton.textContent = selectedMode === 'archive' ? 'Open Selected Archive' : 'Apply Selected View'
	}

	switchMapModeButton.addEventListener('click', () => applyMapModeSelection(modeSelect.value, archiveInput.value))
	archiveButton.addEventListener('click', () => searchArchive(archiveInput.value))
	modeSelect.addEventListener('change', syncModeUI)
	archiveInput.addEventListener('keyup', e => {
		if (e.key !== 'Enter') return
		if (modeSelect.value === 'archive') applyMapModeSelection(modeSelect.value, archiveInput.value)
		else searchArchive(archiveInput.value)
	})
	archiveInput.addEventListener('change', () => {
		if (!isValidArchiveDateInput(archiveInput.value)) return
		localStorage['emcdynmapplus-archive-date'] = archiveInput.value.replaceAll('-', '')
	})

	syncModeUI()
}

/**
 * @param {MapMode | "archive"} nextMode
 * @param {string} archiveDateInput
 */
function applyMapModeSelection(nextMode, archiveDateInput) {
	if (nextMode === 'archive') return searchArchive(archiveDateInput)

	localStorage['emcdynmapplus-mapmode'] = nextMode
	location.reload()
}

/** 
 * @param {HTMLElement} layersList
 * @param {MapMode} curMapMode 
*/
function addOptions(layersList, curMapMode) {
	const existingOptions = layersList.querySelector('#emcdynmapplus-layer-options')
	if (existingOptions) return existingOptions

	addElement(layersList, createElement('div', {
		className: 'leaflet-control-layers-separator emcdynmapplus-layer-separator',
	}))
	const section = addElement(layersList, createElement('div', {
		id: 'emcdynmapplus-layer-options',
		className: 'emcdynmapplus-layer-options',
	}))
	addElement(section, createElement('div', {
		className: 'emcdynmapplus-layer-title',
		text: 'Dynmap+ Options',
	}))
	const optionsMenu = addElement(section, createElement('div', { id: 'options-menu' }))

	const checkboxes = {
		normalizeScroll: addLayerCheckboxOption(
			optionsMenu,
			'toggle-normalize-scroll',
			'Normalize scroll inputs',
			'Smoother zoom input.',
			'normalize-scroll'
		),
		decreaseBrightness: addLayerCheckboxOption(
			optionsMenu,
			'toggle-darkened',
			'Reduce tile brightness',
			'Dims bright tiles.',
			'darkened'
		),
		darkMode: addLayerCheckboxOption(
			optionsMenu,
			'toggle-darkmode',
			'Use dark theme',
			'Darker panel theme.',
			'darkmode'
		),
		serverInfo: addLayerCheckboxOption(
			optionsMenu,
			'toggle-serverinfo',
			'Show server info',
			'Live stats panel.',
			'serverinfo'
		),
	}

	checkboxes.normalizeScroll.addEventListener('change', e => toggleScrollNormalize(e.target.checked))
	checkboxes.decreaseBrightness.addEventListener('change', e => toggleDarkened(e.target.checked))
	checkboxes.darkMode.addEventListener('change', e => toggleDarkMode(e.target.checked))
	checkboxes.serverInfo.addEventListener('change', e => toggleServerInfo(e.target.checked))
	
	if (curMapMode != 'archive') {
		const showCapitalStars = addLayerCheckboxOption(
			optionsMenu,
			'toggle-capital-stars',
			'Show capital stars',
			'Keep capital markers visible.',
			'capital-stars'
		)
		showCapitalStars.addEventListener('change', e => toggleShowCapitalStars(e.target.checked))
	}

	return section
}

/**
 * Adds a option which displays a checkbox
 * @param {string} optionId - The unique string used to query this option
 * @param {string} optionText - The text to display next to the checkbox
 * @param {string} optionDescription - Supporting copy shown beneath the title
 * @param {string} variable - The variable name in storage used to keep the 'checked' state 
 */
function addCheckboxOption(menu, optionId, optionText, optionDescription, variable) {
	const option = addElement(menu, createElement('label', {
		className: 'option sidebar-setting',
		htmlFor: optionId,
	}))
	const copy = addElement(option, createElement('span', { className: 'sidebar-toggle-copy' }))
	addElement(copy, createElement('span', {
		className: 'sidebar-toggle-title',
		text: optionText,
	}))
	addElement(copy, createElement('span', {
		className: 'sidebar-toggle-description',
		text: optionDescription,
	}))
	
	// Initialize checkbox state
	const checkbox = addElement(option, createElement('input', {
		id: optionId,
		className: 'sidebar-switch-input',
		type: 'checkbox',
		attrs: {
			role: 'switch',
		},
	}))
	checkbox.checked = (localStorage['emcdynmapplus-' + variable] == 'true')
	return checkbox
}

/**
 * Adds an option to the Leaflet layer control using its native label structure.
 * @param {HTMLElement} menu
 * @param {string} optionId
 * @param {string} optionText
 * @param {string} optionDescription
 * @param {string} variable
 */
function addLayerCheckboxOption(menu, optionId, optionText, optionDescription, variable) {
	const label = addElement(menu, createElement('label', {
		className: 'emcdynmapplus-layer-option',
		attrs: {
			title: optionDescription,
		},
	}))
	const wrapper = addElement(label, createElement('span'))
	const checkbox = addElement(wrapper, createElement('input', {
		id: optionId,
		className: 'leaflet-control-layers-selector emcdynmapplus-layer-checkbox',
		type: 'checkbox',
		attrs: {
			role: 'switch',
			'aria-label': optionText,
		},
	}))
	addElement(wrapper, createElement('span', {
		text: ` ${optionText}`,
	}))
	checkbox.checked = (localStorage['emcdynmapplus-' + variable] == 'true')
	return checkbox
}

/** @param {HTMLElement} sidebar */
function addLocateMenu(sidebar) {
	const locateMenu = addSidebarSection(
		sidebar,
		'Locate',
		'Jump to a town, nation, or resident.'
	)
	locateMenu.id = 'locate-menu'
	const locateSubmenu = addElement(locateMenu, createElement('div', { className: 'sidebar-split' }))
	const locateSelect = addElement(locateSubmenu, createElement('select', {
		id: 'locate-select',
		className: 'sidebar-input sidebar-select',
	}, [
		createElement('option', { text: 'Town' }),
		createElement('option', { text: 'Nation' }),
		createElement('option', { text: 'Resident' }),
	]))
	const locateInput = addElement(locateMenu, createElement('input', {
		id: 'locate-input',
		className: 'sidebar-input',
		type: 'search',
		placeholder: 'London',
	}))
	const locateButton = addElement(locateMenu, createElement('button', {
		id: 'locate-button',
		className: 'sidebar-button sidebar-button-primary',
		text: 'Locate On Map',
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
	if (serverInfoPanel instanceof HTMLElement) serverInfoPanel.hidden = !boxTicked

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
	if (!document.head.querySelector('#emcdynmapplus-ui-fonts')) {
		addElement(document.head, createElement('link', {
			id: 'emcdynmapplus-ui-fonts',
			rel: 'stylesheet',
			href: 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;700&display=swap',
		}))
	}
	// other stylesheet html links ... 
}

function loadDarkMode() {
	// tell browser not to apply its auto dark mode.
	// this fixes some inverted elements when both are enabled.
	document.documentElement.style.colorScheme = 'dark'
	document.documentElement.setAttribute('data-emcdynmapplus-theme', 'dark')
	document.head.querySelector('#dark-mode')?.remove()
}

function unloadDarkMode() {
	document.documentElement.style.colorScheme = 'light'
	document.documentElement.removeAttribute('data-emcdynmapplus-theme')
	document.head.querySelector('#dark-mode')?.remove()
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
	if (!isValidArchiveDateInput(date)) {
		showAlert(`Choose a valid archive date between ${ARCHIVE_DATE.MIN} and ${ARCHIVE_DATE.MAX}.`, 4)
		return
	}

	const URLDate = date.replaceAll('-', '') // 2026-06-01 -> 20260601
	localStorage['emcdynmapplus-archive-date'] = URLDate // In case 'change' event doesn't already update it
	localStorage['emcdynmapplus-mapmode'] = 'archive'
	location.reload()
}

/** @param {string} date */
function isValidArchiveDateInput(date) {
	if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
	return date >= ARCHIVE_DATE.MIN && date <= ARCHIVE_DATE.MAX
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
