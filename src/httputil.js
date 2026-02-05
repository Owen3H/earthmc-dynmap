console.log('emcdynmapplus: loaded httputil')

const PROJECT_URL = `https://github.com/3meraldK/earthmc-dynmap`
const PROXY_URL = `https://api.codetabs.com/v1/proxy/?quest=`

const EMC_DOMAIN = "earthmc.net"
const CURRENT_MAP = "aurora"

const CAPI_BASE = `https://emcstats.bot.nu`
const MAPI_BASE = `https://map.${EMC_DOMAIN}`
const OAPI_BASE = `https://api.${EMC_DOMAIN}/v3` // bump number here after migrating to a new OAPI ver

const OAPI_REQ_PER_MIN = 180
const OAPI_ITEMS_PER_REQ = 100

const bucket = new TokenBucket(OAPI_REQ_PER_MIN, OAPI_REQ_PER_MIN / (60 * 1000))
bucket.start()

/**
 * Sends a request to a url, parsing the response as JSON unless we received 404.
 * @param {string} url - The URL to retrieve data from.
 * @param {RequestInit} options - Optional options like method, body, credentials etc.
 */
async function fetchJSON(url, options = null) {
    const response = await fetch(url, options)
    if (!response.ok && response.status != 304) return null

    return response.json()
}

/**
 * Sends a POST request to a url with the body, parsing the response as JSON unless we received 404.
 * @param {string} url - The URL to send and retrieve data from.
 * @param {Object} body - A JS object that is automatically stringified. 
 */
const postJSON = (url, body) => fetchJSON(url, { body: JSON.stringify(body), method: 'POST' })

/**
 * Fetches an info object from the Official API base endpoint.
 * @returns {Promise<ServerInfo>}
 */
const fetchServerInfo = () => fetchJSON(`${OAPI_BASE}/${CURRENT_MAP}`)

/**
 * Sends multiple requests and concatenates the results to circumvent 
 * the query limit while adhering to the rate limit.
 * @param {string} url 
 * @param {Array<any>} arr 
 */
async function queryConcurrent(url, arr) {
	const chunks = chunkArr(arr, OAPI_ITEMS_PER_REQ)

	const promises = chunks.map(async chunk => {
		await bucket.take()
		return sendBatch(url, chunk)
	})

	const batchResults = await Promise.all(promises)
	return batchResults.flat()
}

/**
 * Splits an array into sub arrays by chunkSize
 * @param {Array<any>} arr 
 * @param {number} chunkSize 
 */
function chunkArr(arr, chunkSize) {
	/** @type {Array<Array>} */
	const chunks = []
	for (let i = 0; i < arr.length; i += chunkSize) {
		chunks.push(arr.slice(i, i + chunkSize))
	}
	return chunks
}

/**
 * @param {string} url 
 * @param {Array<{uuid: string}>} chunk 
 */
async function sendBatch(url, chunk) {
	return postJSON(url, { query: chunk.map(e => e.uuid) }).catch(err => {
		console.error('emcdynmapplus: error sending request:', err)
		return []
	})
}

/** @param {number} ms */
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

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