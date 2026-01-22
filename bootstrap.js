(async function bootstrap() {
    function switchMapMode() {
        const nextMapMode = {
            default: 'meganations',
            meganations: 'alliances',
            alliances: 'default',
        }

        localStorage['emcdynmapplus-mapmode'] = nextMapMode[currentMapMode()] ?? 'meganations'
        location.reload()
    }

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

        waitForElement('.leaflet-top.leaflet-left').then(el => addMainMenu(el))

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