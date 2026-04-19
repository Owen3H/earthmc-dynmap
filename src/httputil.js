/** ANYTHING RELATED TO NETWORKING BELONGS IN HERE */
//console.log('emcdynmapplus: loaded httputil')

const PROJECT_URL = `https://github.com/3meraldK/earthmc-dynmap`
const PROXY_URLS = [
	`https://api.codetabs.com/v1/proxy/?quest=`, // Main proxy
	`https://everyorigin.jwvbremen.nl/get?url=`, // Fallback #1
	`https://proxy.corsfix.com`,				 // Fallback #2
	`https://api.cors.lol/?url=`,				 // Fallback #3
	`https://proxy.killcors.com/?url=`			 // Fallback #4
]

const EMC_DOMAIN = "earthmc.net"
const CURRENT_MAP = location.href.includes('aurora') ? "aurora" : "nostra"

const CAPI_BASE = `https://emcstats.bot.nu`
const MAPI_BASE = `https://map.${EMC_DOMAIN}`
const OAPI_BASE = `https://api.${EMC_DOMAIN}`

const OAPI_REQ_PER_MIN = 180
const OAPI_ITEMS_PER_REQ = 100

const currentMapApiUrl = () => CURRENT_MAP == 'aurora' ? `${OAPI_BASE}/v3/aurora` : `${OAPI_BASE}/v4`

/**
 * Token/leaky bucket implementation with localStorage caching.\
 * Useful for rate limiting requests client side while persisting the bucket state through reloads.
 */
class TokenBucket {
	/** @param {TokenBucketOptions} opts */
	constructor(opts) {
		this.capacity = opts.capacity       // max tokens
		this.refillRate = opts.refillRate   // token refill rate (per sec)
		this.storageKey = opts.storageKey	// localStorage key

		// load previous bucket state if available
		const cachedBucket = localStorage[this.storageKey]
		if (cachedBucket) {
			/** @type {TokenBucketStored} */
			const bucketData = JSON.parse(cachedBucket)
			const elapsed = (Date.now() - bucketData.lastRefill) / 1000
			const added = elapsed * opts.refillRate
			this.tokens = Math.min(opts.capacity, bucketData.tokens + added)
		} else {
			this.tokens = opts.capacity
		}

		this.lastRefill = Date.now()
	}

	#save() {
		const bucketInfo = { tokens: this.tokens, lastRefill: this.lastRefill }
		localStorage[this.storageKey] = JSON.stringify(bucketInfo)
	}

	refill() {
		const now = Date.now()
		const elapsed = (now - this.lastRefill) / 1000
		if (elapsed <= 0) return

		const added = elapsed * this.refillRate
		this.tokens = Math.min(this.capacity, this.tokens + added)
		this.lastRefill = now
		this.#save()
	}

	take = async () => new Promise(resolve => {
		const attempt = () => {
			this.refill()
			if (this.tokens >= 1) {
				this.tokens -= 1
				this.#save()
				resolve()
			} else {
				// automatically retry after enough time for one token
				const msUntilNext = Math.ceil((1 - this.tokens) / this.refillRate * 1000)
				setTimeout(attempt, msUntilNext)
			}
		}

		attempt()
	})
}

const oapiBucket = new TokenBucket({
	capacity: OAPI_REQ_PER_MIN,
	refillRate: OAPI_REQ_PER_MIN / 60,
	storageKey: 'emcdynmapplus-oapi-bucket'
})

/**
 * Sends a request to a url, parsing the response as JSON unless we received 404.
 * @param {string} url - The URL to retrieve data from.
 * @param {RequestInit} options - Optional options like method, body, credentials etc.
 */
async function fetchJSON(url, options = null) {
	if (url.includes(OAPI_BASE)) await oapiBucket.take()

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
const fetchServerInfo = async () => fetchJSON(currentMapApiUrl())

/**
 * Fetches an archived markers.json from the Wayback Machine at the given date.
 * The markers URL is automatically determined by the date since it changed multiple times over the years.
 * @param {number} date 
 * @param {string} markersURL
 */
const fetchArchive = async date => {
	const markersURL = // markers.json URL changed over time
		date < 20230212 ? `https://earthmc.net/map/aurora/tiles/_markers_/marker_earth.json` :
		date < 20240701 ? `https://earthmc.net/map/aurora/standalone/MySQL_markers.php?marker=_markers_/marker_earth.json` :
		`https://map.earthmc.net/tiles/minecraft_overworld/markers.json` // latest

	const archiveURL = `https://web.archive.org/web/${date}id_/${markersURL}`
	for (const proxyUrl of PROXY_URLS) {
		try {
			const res = await fetch(proxyUrl + archiveURL)
			if (!res.ok) continue

			return await res.json()
		} catch {}
	}

	throw new Error(`Could not fetch archive! All ${PROXY_URLS.length} proxies failed :(`)
}

/**
 * Sends multiple requests and concatenates the results to circumvent 
 * the query limit while adhering to the rate limit.
 * @param {string} url 
 * @param {Array<any>} arr 
 */
async function queryConcurrent(url, arr) {
	const chunks = chunkArr(arr, OAPI_ITEMS_PER_REQ)
	const promises = chunks.map(async chunk => {
		await oapiBucket.take()
		return sendBatch(url, chunk)
	})

	const batchResults = await Promise.all(promises)
	return batchResults.flat()
}

/**
 * Splits an array into sub arrays by chunk size `sz`.
 * @param {Array} arr 
 * @param {number} chunkSize
 * @returns {Array<Array>}
 */
function chunkArr(arr, sz) {
	const ch = []
	let i = 0, len = arr.length
	for (; i < len; i += sz) { ch.push(arr.slice(i, i + sz)) }
	return ch
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