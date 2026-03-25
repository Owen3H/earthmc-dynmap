/** ANY CODE RELATING TO THE MAIN ONSCREEN EXTENSION MENU GOES HERE */
//console.log('emcdynmapplus: loaded menu')

// TODO: Use Custom Element Registry and convert the main menu into one.

const MAP_MODE_METADATA = [
	{
		value: 'planning',
		label: 'Planning',
		description: 'Draw simple custom nation circles directly on the live map.',
	},
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
const PLANNER_STORAGE_KEY = 'emcdynmapplus-planner-nations'
const PLANNING_PLACEMENT_ARMED_KEY = 'emcdynmapplus-planning-placement-armed'
const PLANNING_UI_PREFIX = 'emcdynmapplus[planning-ui]'
const DEFAULT_PLANNING_NATION_RANGE = 750
const DEFAULT_PLANNING_NATION = {
	id: 'hardcoded-demo-nation',
	name: 'Planning Nation',
	color: '#d98936',
	outlineColor: '#fff3cf',
	rangeRadiusBlocks: DEFAULT_PLANNING_NATION_RANGE,
}
let planningPlacementClickInitialized = false

function isPlanningDebugLoggingEnabled() {
	try {
		return localStorage['emcdynmapplus-debug'] === 'true'
	} catch {
		return false
	}
}

const planningDebugInfo = (...args) => {
	if (isPlanningDebugLoggingEnabled()) console.info(...args)
}

function updateSidebarContentPosition(sidebarSummary, sidebarContent) {
	if (!(sidebarSummary instanceof HTMLElement) || !(sidebarContent instanceof HTMLElement)) return

	const summaryRect = sidebarSummary.getBoundingClientRect()
	const viewportPadding = 12
	const verticalGap = 8
	const fallbackWidth = 292
	const measuredWidth = sidebarContent.offsetWidth || fallbackWidth
	const maxLeft = Math.max(viewportPadding, window.innerWidth - measuredWidth - viewportPadding)
	const left = Math.min(Math.max(viewportPadding, Math.round(summaryRect.left)), maxLeft)
	const top = Math.max(viewportPadding, Math.round(summaryRect.bottom + verticalGap))
	const maxHeight = Math.max(220, window.innerHeight - top - viewportPadding)

	sidebarContent.style.left = `${left}px`
	sidebarContent.style.top = `${top}px`
	sidebarContent.style.maxHeight = `${maxHeight}px`

	planningDebugInfo('emcdynmapplus[sidebar-ui]: updated floating sidebar position', {
		left,
		top,
		maxHeight,
		summaryRect: {
			left: Math.round(summaryRect.left),
			top: Math.round(summaryRect.top),
			bottom: Math.round(summaryRect.bottom),
		},
	})
}

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
		if (sidebar.open) requestAnimationFrame(() => updateSidebarContentPosition(sidebarSummary, sidebarContent))
	})
	const sidebarSummary = addSidebarSummary(sidebar, curMapMode)
	const toggleSidebar = event => {
		event.preventDefault()
		event.stopPropagation()
		sidebar.open = !sidebar.open
		localStorage[SIDEBAR_EXPANDED_KEY] = String(sidebar.open)
		if (sidebar.open) requestAnimationFrame(() => updateSidebarContentPosition(sidebarSummary, sidebarContent))
	}
	sidebarSummary.addEventListener('click', toggleSidebar)
	sidebarSummary.addEventListener('keydown', event => {
		if (event.key !== 'Enter' && event.key !== ' ') return
		toggleSidebar(event)
	})

	const sidebarContent = addElement(sidebar, createElement('div', { id: 'sidebar-content' }))
	addSidebarHeader(sidebarContent, curMapMode)
	addLocateMenu(sidebarContent) // Locator button and input box
	addMapModeSection(sidebarContent, curMapMode)
	if (curMapMode == 'planning') addPlanningSection(sidebarContent)

	window.addEventListener('resize', () => updateSidebarContentPosition(sidebarSummary, sidebarContent))
	window.addEventListener('scroll', () => updateSidebarContentPosition(sidebarSummary, sidebarContent), true)
	requestAnimationFrame(() => updateSidebarContentPosition(sidebarSummary, sidebarContent))

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

	if (nextMode !== 'planning') setPlanningPlacementArmed(false)
	localStorage['emcdynmapplus-mapmode'] = nextMode
	location.reload()
}

function loadPlanningNations() {
	try {
		const stored = localStorage[PLANNER_STORAGE_KEY]
		if (!stored) return []

		const parsed = JSON.parse(stored)
		return Array.isArray(parsed) ? parsed : []
	} catch {
		return []
	}
}

function savePlanningNations(nations) {
	localStorage[PLANNER_STORAGE_KEY] = JSON.stringify(nations)
}

function isPlanningPlacementArmed() {
	return localStorage[PLANNING_PLACEMENT_ARMED_KEY] === 'true'
}

function setPlanningPlacementArmed(armed) {
	localStorage[PLANNING_PLACEMENT_ARMED_KEY] = String(armed)
	planningDebugInfo(`${PLANNING_UI_PREFIX}: placement armed state updated`, { armed })
}

function getHardcodedPlanningNation() {
	return loadPlanningNations().find(nation => nation?.id === DEFAULT_PLANNING_NATION.id) ?? null
}

function hasHardcodedPlanningNation() {
	return getHardcodedPlanningNation() != null
}

function buildPlanningNation(center) {
	return {
		...DEFAULT_PLANNING_NATION,
		center: {
			x: Math.round(center.x),
			z: Math.round(center.z),
		},
	}
}

function removeHardcodedPlanningNation() {
	setPlanningPlacementArmed(false)
	savePlanningNations(loadPlanningNations().filter(nation => nation?.id !== DEFAULT_PLANNING_NATION.id))
	location.reload()
}

function parsePlanningCoords(text) {
	if (typeof text !== 'string' || text.trim().length === 0) return null

	const normalized = text.replaceAll(',', ' ')
	const xMatch = normalized.match(/(?:^|\b)x\b[^-\d]*(-?\d+(?:\.\d+)?)/i)
	const zMatch = normalized.match(/(?:^|\b)z\b[^-\d]*(-?\d+(?:\.\d+)?)/i)
	if (xMatch?.[1] && zMatch?.[1]) {
		return {
			x: Math.round(Number(xMatch[1])),
			z: Math.round(Number(zMatch[1])),
		}
	}

	const numericMatches = [...normalized.matchAll(/-?\d+(?:\.\d+)?/g)]
		.map(match => Number(match[0]))
		.filter(value => Number.isFinite(value))
	if (numericMatches.length < 2) return null

	return {
		x: Math.round(numericMatches[0]),
		z: Math.round(numericMatches[numericMatches.length - 1]),
	}
}

function getPlanningCoordsText() {
	return document.querySelector('.leaflet-control-layers.coordinates')?.textContent?.trim() ?? ''
}

function placeHardcodedPlanningNation(center) {
	const nation = buildPlanningNation(center)
	const nations = loadPlanningNations().filter(existingNation => existingNation?.id !== DEFAULT_PLANNING_NATION.id)
	savePlanningNations([...nations, nation])
	setPlanningPlacementArmed(false)
	planningDebugInfo(`${PLANNING_UI_PREFIX}: stored planning nation from map click`, {
		center: nation.center,
		rangeRadiusBlocks: nation.rangeRadiusBlocks,
	})
	location.reload()
}

function handlePlanningPlacementClick(event) {
	if (!isPlanningPlacementArmed()) return
	if (currentMapMode() !== 'planning') return

	const target = event.target
	if (!(target instanceof HTMLElement)) return
	if (!target.closest('.leaflet-container')) return
	if (target.closest('.leaflet-control-container')) return

	const rawCoordinatesText = getPlanningCoordsText()
	const coords = parsePlanningCoords(rawCoordinatesText)
	planningDebugInfo(`${PLANNING_UI_PREFIX}: captured map click while armed`, {
		rawCoordinatesText,
		targetTag: target.tagName,
		targetClassName: target.className || null,
		coords,
	})

	if (!coords) {
		showAlert('Could not read map coordinates for planning placement. Move the cursor over the map and try again.', 5)
		return
	}

	placeHardcodedPlanningNation(coords)
}

function ensurePlanningPlacementClickHandler() {
	if (planningPlacementClickInitialized) return

	document.addEventListener('click', handlePlanningPlacementClick, true)
	planningPlacementClickInitialized = true
	planningDebugInfo(`${PLANNING_UI_PREFIX}: attached planning placement click listener`)
}

function armPlanningPlacement() {
	setPlanningPlacementArmed(true)
	ensurePlanningPlacementClickHandler()
	showAlert('Planning placement armed. Click on the live map to place the nation.', 5)
	planningDebugInfo(`${PLANNING_UI_PREFIX}: placement armed`, {
		existingNationCenter: getHardcodedPlanningNation()?.center ?? null,
	})
}

function addPlanningSection(sidebar) {
	const section = addSidebarSection(
		sidebar,
		'Planning',
		'Arm placement, click the live map once, and render a simple nation circle at that world position.'
	)
	section.id = 'planning-section'
	ensurePlanningPlacementClickHandler()

	const placedNation = getHardcodedPlanningNation()
	const placedCenter = placedNation?.center ?? null

	const chipRow = addElement(section, createElement('div', { className: 'planning-chip-row' }, [
		createElement('div', {
			className: 'planning-chip',
			attrs: { 'data-emphasis': String(placedNation != null) },
		}, [
			createElement('span', {
				className: 'planning-chip-label',
				text: 'Nation',
			}),
			createElement('strong', {
				id: 'planning-nation-status',
				className: 'planning-chip-value',
				text: placedNation ? 'Placed' : 'Not Placed',
			}),
		]),
		createElement('div', { className: 'planning-chip' }, [
			createElement('span', {
				className: 'planning-chip-label',
				text: 'Placement',
			}),
			createElement('strong', {
				id: 'planning-placement-status',
				className: 'planning-chip-value',
				text: isPlanningPlacementArmed() ? 'Armed' : 'Idle',
			}),
		]),
		createElement('div', { className: 'planning-chip' }, [
			createElement('span', {
				className: 'planning-chip-label',
				text: 'Range',
			}),
			createElement('strong', {
				className: 'planning-chip-value',
				text: `${DEFAULT_PLANNING_NATION_RANGE} b`,
			}),
		]),
		createElement('div', { className: 'planning-chip' }, [
			createElement('span', {
				className: 'planning-chip-label',
				text: 'Center',
			}),
			createElement('strong', {
				id: 'planning-center-label',
				className: 'planning-chip-value',
				text: placedCenter ? `X ${placedCenter.x} Z ${placedCenter.z}` : 'Not set',
			}),
		]),
	]))
	void chipRow

	addElement(section, createElement('p', {
		className: 'sidebar-help planning-inline-note',
		text: 'The button arms placement. Your next click on the map reads the live coordinate widget and stores the nation center there.',
	}))

	const actionRow = addElement(section, createElement('div', { className: 'planning-actions-grid' }))
	const createNationButton = addElement(actionRow, createElement('button', {
		className: 'sidebar-button sidebar-button-primary',
		id: 'planning-place-button',
		text: isPlanningPlacementArmed() ? 'Click Map To Place' : (placedNation ? 'Reposition Nation' : 'Place Nation On Map'),
		type: 'button',
	}))

	const removeNationButton = addElement(actionRow, createElement('button', {
		className: 'sidebar-button sidebar-button-secondary sidebar-button-danger',
		id: 'planning-remove-button',
		text: isPlanningPlacementArmed() && !placedNation ? 'Cancel Placement' : 'Remove Nation',
		type: 'button',
	}))
	removeNationButton.disabled = !placedNation && !isPlanningPlacementArmed()
	removeNationButton.addEventListener('click', () => {
		if (isPlanningPlacementArmed() && !hasHardcodedPlanningNation()) {
			setPlanningPlacementArmed(false)
			syncPlanningSectionState()
			return
		}

		removeHardcodedPlanningNation()
	})

	addElement(section, createElement('p', {
		className: 'sidebar-help',
		text: 'Logs: open the console with emcdynmapplus-debug=true and look for emcdynmapplus[planning-ui] and emcdynmapplus[planning-layer].',
	}))

	const syncPlanningSectionState = () => {
		const activeNation = getHardcodedPlanningNation()
		const isArmed = isPlanningPlacementArmed()
		const center = activeNation?.center ?? null
		section.querySelector('#planning-nation-status').textContent = activeNation ? 'Placed' : 'Not Placed'
		section.querySelector('#planning-placement-status').textContent = isArmed ? 'Armed' : 'Idle'
		section.querySelector('#planning-center-label').textContent = center ? `X ${center.x} Z ${center.z}` : 'Not set'
		createNationButton.textContent = isArmed ? 'Click Map To Place' : (activeNation ? 'Reposition Nation' : 'Place Nation On Map')
		removeNationButton.textContent = isArmed && !activeNation ? 'Cancel Placement' : 'Remove Nation'
		removeNationButton.disabled = !activeNation && !isArmed

		const nationChip = section.querySelector('.planning-chip')
		nationChip?.setAttribute('data-emphasis', String(activeNation != null))
	}

	createNationButton.addEventListener('click', () => {
		armPlanningPlacement()
		syncPlanningSectionState()
	})
	syncPlanningSectionState()

	return section
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
