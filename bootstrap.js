// Bootstrap must always be injected last to ensure all funcs/objs from previous injections are defined. 
// For example, waitForElement from ui.js can be referred to after bootstrap finishes.
// 
// This is also where init is called from after the DOM becomes ready.
(async function bootstrap() {
    /** @returns {string} */
    function checkForUpdate() {
        const cachedVer = localStorage['emcdynmapplus-version']
        const latestVer = window.CURRENT_VERSION

        if (!cachedVer) return localStorage['emcdynmapplus-version'] = latestVer
        if (cachedVer != latestVer) {
            const changelogURL = `${PROJECT_URL}/releases/v${latestVer}`
            showAlert(`
                Extension has been automatically updated from ${cachedVer} to ${latestVer}. 
                Read what has been changed <a href="${changelogURL}" target="_blank">here</a>.
            `)
        }

        return localStorage['emcdynmapplus-version'] = latestVer
    }

    const init = () => {
        console.log("emcdynmapplus: Initializing UI elements..")

        localStorage['emcdynmapplus-mapmode'] ??= 'meganations'
        localStorage['emcdynmapplus-darkened'] ??= true

        waitForElement('.leaflet-tile-pane').then(() => {
            if (localStorage['emcdynmapplus-darkened'] === 'true') decreaseBrightness(true)
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

        waitForElement('.leaflet-nameplate-pane').then(el => el.style = '')

        checkForUpdate()
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _ => init())
    } else {
        init()
    }
})()