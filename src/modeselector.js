/** ANY CODE RELATING TO THE MAP MODE SELECTOR GOES HERE */
//console.log('emcdynmapplus: loaded mode selector')

const DEFAULT_MODE_IMG = "https://cdn.modrinth.com/data/U3DcJoj5/6f5fd037773b1e4eb517079e69d23ded992840f4.png"
const MAP_MODES = /** @type {const} */ ({
    DEFAULT:        { name: "default",      img: DEFAULT_MODE_IMG },
    ALLIANCES:      { name: "alliances",    img: DEFAULT_MODE_IMG },
    MEGANATIONS:    { name: "meganations",  img: DEFAULT_MODE_IMG },
    OVERCLAIM:      { name: "overclaim",    img: DEFAULT_MODE_IMG },
    NATIONCLAIMS:   { name: "nationclaims", img: DEFAULT_MODE_IMG },
    ARCHIVE:        { name: "archive",      img: DEFAULT_MODE_IMG },
})

const MapMode = MAP_MODES // this exists at runtime to replace the typedef

/**
 * @typedef {typeof MAP_MODES[keyof typeof MAP_MODES]} MapMode
 * @typedef {MapMode["name"]} MapModeName
 */

/** @param {HTMLElement} parent - The "leaflet-top leaflet-left" element. */
function addMapModeSelector(parent) {
    const selectorDiv = addElement(parent, INSERTABLE_HTML.mapMode.selector)

    const currentMapModeLabel = addElement(selectorDiv, INSERTABLE_HTML.mapMode.currentModeLabel)
	currentMapModeLabel.textContent = currentMapModeLabel.textContent.replace('{currentMapMode}', currentMapMode().name)

    const iconContainer = addElement(selectorDiv, INSERTABLE_HTML.mapMode.optionContainer)
    
    const modes = Object.values(MAP_MODES)
    for (const mode of modes) {
        if (mode == MapMode.ARCHIVE) continue
        addMapModeIcon(iconContainer, mode.img, _ => switchMapMode(mode))
    }
}

function addMapModeIcon(parent, imgSrc, clickHandler = null) {
    const button = addElement(parent, INSERTABLE_HTML.mapMode.btnOption)
    addElement(button, `<img src="${imgSrc}">`)

    if (clickHandler) button.addEventListener('click', clickHandler)
}

/** @type {() => MapMode} */
const currentMapMode = () => {
    const name = localStorage['emcdynmapplus-mapmode']
	if (!name) return MapMode.DEFAULT

    return Object.values(MAP_MODES).find(m => m.name === name) ?? MAP_MODES.DEFAULT
}

/** @param {MapMode} currentMode */
function switchMapMode(currentMode) {
    const modes = Object.values(MAP_MODES)
    const nextIndex = (modes.indexOf(currentMode) + 1) % modes.length
    const nextMode = modes[nextIndex]

    localStorage['emcdynmapplus-mapmode'] = nextMode.name
    location.reload()
}