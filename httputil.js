const EMC_DOMAIN = "earthmc.net"
const CURRENT_MAP = "aurora"

const OAPI_BASE = `https://api.${EMC_DOMAIN}/v3` // bump number here after migrating to a new OAPI ver
const MAPI_BASE = `https://map.${EMC_DOMAIN}`
const CAPI_BASE = `https://emcstats.bot.nu`

const PROXY_URL = `https://api.codetabs.com/v1/proxy/?quest=`
const PROJECT_URL = "https://github.com/3meraldK/earthmc-dynmap"

/**
 * Fetches data at url, parsing it as JSON unless we received 404.
 * @param {string} url 
 * @param {RequestInit} options 
 */
// Only ever used in content context.
async function fetchJSON(url, options = null) {
    const response = await fetch(url, options)
    if (!response.ok && response.status != 304) return null

    return response.json()
}