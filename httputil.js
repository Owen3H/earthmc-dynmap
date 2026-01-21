export const EMC_DOMAIN = "earthmc.net"
export const CURRENT_MAP = "aurora"

export const OAPI_BASE = `https://api.${EMC_DOMAIN}/v3` // bump version here after updating code to new api ver
export const MAPI_BASE = `https://map.${EMC_DOMAIN}`
export const CAPI_BASE = `https://emcstats.bot.nu`

export const PROXY_URL = `https://api.codetabs.com/v1/proxy/?quest=`

/**
 * Fetches data at url, parsing it as JSON unless we received 404.
 * @param {string} url 
 * @param {RequestInit} options 
 */
export async function fetchJSON(url, options = null) {
    const response = await fetch(url, options)
    if (response.status == 404) return null
    if (response.ok) return response.json()

    return null
}