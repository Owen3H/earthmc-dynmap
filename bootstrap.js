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

/** 
 * @param {CustomEvent<{MANIFEST_VERSION: string}>} event - The custom EMCDYNMAPPLUS_READY event.
 * @returns {string} */
function checkForUpdate(event) {
    const cachedVer = localStorage['emcdynmapplus-version']
    const latestVer = event.detail.MANIFEST_VERSION
    console.log("emcdynmapplus: current version is: " + latestVer)

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