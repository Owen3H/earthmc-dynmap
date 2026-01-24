// Bootstrap must always be injected last into the same page context as all other funcs & objs. 
// This is so everything is defined when we get to init() and during fetch intercepts.
(async function bootstrap() {
    document.addEventListener('EMCDYNMAPPLUS_READY', checkForUpdate)

    // If not 'complete' or 'interactive', defer init until DOM is ready.
    if (document.readyState !== 'loading') return init()
    document.addEventListener('DOMContentLoaded', _ => init())
})()

function init() {
    console.log("emcdynmapplus: Initializing UI elements..")

    localStorage['emcdynmapplus-mapmode'] ??= 'meganations'
    localStorage['emcdynmapplus-darkened'] ??= true
    
    insertSidebarMenu()
    editUILayout()
    initToggleOptions() // brightness and dark mode
}

function initToggleOptions() {
    waitForElement('.leaflet-tile-pane').then(() => {
        if (localStorage['emcdynmapplus-darkened'] === 'true') decreaseBrightness(true)
    })

    const darkPref = localStorage['emcdynmapplus-darkmode']
    const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
    if (darkPref === 'true' || (!darkPref && systemDark)) {
        localStorage['emcdynmapplus-darkmode'] = 'true'
        loadDarkMode()
    }
}

function insertSidebarMenu() {
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

    // Keep the layer toggle on the right of the main menu
    waitForElement('.leaflet-control-layers-toggle').then(el => {
        if (el?.parentElement) {
            el.parentElement.style.clear = 'none'
        }
    })

    // Fix nameplates appearing over popups
    waitForElement('.leaflet-nameplate-pane').then(el => el.style = '')
}