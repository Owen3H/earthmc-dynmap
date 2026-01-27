console.log('emcdynmapplus: loaded httputil')

const EMC_DOMAIN = "earthmc.net"
const CURRENT_MAP = "aurora"

const OAPI_BASE = `https://api.${EMC_DOMAIN}/v3` // bump number here after migrating to a new OAPI ver
const MAPI_BASE = `https://map.${EMC_DOMAIN}`
const CAPI_BASE = `https://emcstats.bot.nu`

const PROXY_URL = `https://api.codetabs.com/v1/proxy/?quest=`
const PROJECT_URL = `https://github.com/3meraldK/earthmc-dynmap`
// const MARKERS_URL = `https://web.archive.org/web/2024id_/https://earthmc.net/map/aurora/standalone/MySQL_markers.php?marker=_markers_/marker_earth.json`

/**
 * Fetches data at url, parsing it as JSON unless we received 404.
 * @param {string} url 
 * @param {RequestInit} options 
 */
async function fetchJSON(url, options = null) {
    const response = await fetch(url, options)
    if (!response.ok && response.status != 304) return null

    return response.json()
}

/**
 * Fetches an info object from the Official API base endpoint.
 * @returns {Promise<ServerInfo>}
 */
async function fetchServerInfo() {
    return fetchJSON(`${OAPI_BASE}/${CURRENT_MAP}`)
}

/**
 * @typedef {Object} ServerInfo
 * @property {string} version
 * @property {string} moonPhase
 * @property {ServerTimestamps} timestamps
 * @property {ServerStatus} status
 * @property {ServerStats} stats
 * @property {ServerVoteParty} voteParty
 */

/**
 * @typedef {Object} ServerTimestamps
 * @property {number} newDayTime
 * @property {number} serverTimeOfDay
 */

/**
 * @typedef {Object} ServerStatus
 * @property {boolean} hasStorm
 * @property {boolean} isThundering
 */

/**
 * @typedef {Object} ServerStats
 * @property {number} time
 * @property {number} fullTime
 * @property {number} maxPlayers
 * @property {number} numOnlinePlayers
 * @property {number} numOnlineNomads
 * @property {number} numResidents
 * @property {number} numNomads
 * @property {number} numTowns
 * @property {number} numTownBlocks
 * @property {number} numNations
 * @property {number} numQuarters
 * @property {number} numCuboids
 */

/**
 * @typedef {Object} ServerVoteParty
 * @property {number} target
 * @property {number} numRemaining
 */