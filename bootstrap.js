// Bootstrap must always be injected last into the same context 
// to ensure all funcs/objs from previous injections are defined. 
//
// For example, we can be certain that waitForElement from dom.js can be referred to we get to init.
(async function bootstrap() {
    document.addEventListener('EMCDYNMAPPLUS_READY', checkForUpdate)

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _ => init())
    } else {
        init()
    }
})()

function init() {
    console.log("emcdynmapplus: Initializing UI elements..")

    localStorage['emcdynmapplus-mapmode'] ??= 'meganations'
    localStorage['emcdynmapplus-darkened'] ??= true

    waitForElement('.leaflet-tile-pane').then(() => {
        if (localStorage['emcdynmapplus-darkened'] === 'true') decreaseBrightness(true)
    })
    
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

    if (localStorage['emcdynmapplus-darkmode'] === 'true') loadDarkMode()

    // Fix nameplates appearing over popups
    waitForElement('.leaflet-nameplate-pane').then(el => el.style = '')
}