/** ANY CODE RELATING TO THE MAP MODE SELECTOR GOES HERE */
//console.log('emcdynmapplus: loaded mode selector')

const sortedMapModes = () => Object.values(MAP_MODES).sort((a, b) => a.order - b.order)
const MAP_MODES = /** @type {const} */ ({
    DEFAULT:        { name: "default",      img: "resources/map-mode-default.png", order: 0 },
    MEGANATIONS:    { name: "meganations",  img: "resources/map-mode-meganations.png", order: 1 },
    ALLIANCES:      { name: "alliances",    img: "resources/map-mode-alliances.png", order: 2 },
    OVERCLAIM:      { name: "overclaim",    img: "resources/map-mode-overclaim.png", order: 3 },
    NATIONCLAIMS:   { name: "nationclaims", img: "resources/map-mode-nationclaims.png", order: 4 },
    ARCHIVE:        { name: "archive",      img: null, order: 5 }, // null img to avoid showing up in the selector
})

Object.freeze(MAP_MODES)

const MapMode = MAP_MODES // this exists at runtime to replace the typedef

/**
 * @typedef {typeof MAP_MODES[keyof typeof MAP_MODES]} MapMode
 * @typedef {MapMode["name"]} MapModeName
 */

/** @param {HTMLElement} parent - The "leaflet-top leaflet-left" element. */
function addMapModeSelector(parent) {
    const selectorDiv = addElement(parent, INSERTABLE_HTML.mapMode.selector)

    const label = addElement(selectorDiv, INSERTABLE_HTML.mapMode.currentModeLabel)
    const iconContainer = addElement(selectorDiv, INSERTABLE_HTML.mapMode.optionContainer)
    
    const modes = sortedMapModes()
    for (const mode of modes) {
        if (mode.img == null) continue
        addMapModeBtn(iconContainer, mode, _ => selectMapMode(mode))
    }

    const curMode = currentMapMode()
    console.log(curMode.name)

    label.textContent = `Map Mode: ${curMode.name}`
}

const GITHUB_REPO = "https://raw.githubusercontent.com/Owen3H/earthmc-dynmap/refs/heads/main/"

/**
 * Adds a map mode button to its parent container div using its img/icon and btn handler.
 * @param {HTMLDivElement} iconContainer 
 * @param {MapMode} mode 
 * @param {(mode: MapMode) => void} clickHandler 
 */
function addMapModeBtn(iconContainer, mode, clickHandler = null) {
    const button = addElement(iconContainer, INSERTABLE_HTML.mapMode.btnOption)
    addElement(button, `<img title="${mode.name}" alt="${mode.name}" src="${GITHUB_REPO + mode.img}">`)

    if (clickHandler) button.addEventListener('click', clickHandler)
}

/** @type {() => MapMode} */
const currentMapMode = () => {
    const name = localStorage['emcdynmapplus-mapmode']
	if (!name) return MapMode.DEFAULT

    return sortedMapModes().find(m => m.name == name) ?? MapMode.DEFAULT
}

/** @param {MapMode} currentMode */
function selectMapMode(mode) {
    localStorage['emcdynmapplus-mapmode'] = mode.name
    location.reload()
}