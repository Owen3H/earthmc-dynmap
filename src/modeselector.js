/** ANY CODE RELATING TO THE MAP MODE SELECTOR GOES HERE */
//console.log('emcdynmapplus: loaded mode selector')

const EXAMPLE_IMG = "https://cdn.modrinth.com/data/U3DcJoj5/6f5fd037773b1e4eb517079e69d23ded992840f4.png"

/** @param {HTMLElement} parent - The "leaflet-top leaflet-left" element. */
function addMapModeSelector(parent) {
    const selectorDiv = addElement(parent, INSERTABLE_HTML.mapMode.selector)

    const currentMapModeLabel = addElement(selectorDiv, INSERTABLE_HTML.mapMode.currentModeLabel)
	currentMapModeLabel.textContent = currentMapModeLabel.textContent.replace('{currentMapMode}', currentMapMode())

    const iconContainer = addElement(selectorDiv, INSERTABLE_HTML.mapMode.optionContainer)
    addMapModeIcon(iconContainer, EXAMPLE_IMG)
    addMapModeIcon(iconContainer, EXAMPLE_IMG)
    addMapModeIcon(iconContainer, EXAMPLE_IMG)
    addMapModeIcon(iconContainer, EXAMPLE_IMG)
    addMapModeIcon(iconContainer, EXAMPLE_IMG)
}

function addMapModeIcon(parent, imgSrc, clickHandler = null) {
    const button = addElement(parent, INSERTABLE_HTML.mapMode.btnOption)
    addElement(button, `<img src="${imgSrc}">`)

    if (clickHandler) button.addEventListener('click', clickHandler)
}