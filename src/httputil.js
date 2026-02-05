/** ANYTHING RELATED TO NETWORKING */
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

/** Token bucket rate limiter */
class TokenBucket {
	constructor(capacity, refillRate, storageKey) {
		this.capacity = capacity       // max tokens
		this.refillRate = refillRate   // tokens per second
		this.storageKey = storageKey

		// load previous bucket state
		const cachedBucket = localStorage.getItem(this.storageKey)
		if (cachedBucket) {
			const bucketData = JSON.parse(cachedBucket)
			const elapsed = (Date.now() - bucketData.lastRefill) / 1000
			const added = elapsed * this.refillRate
			this.tokens = Math.min(capacity, bucketData.tokens + added)
			this.lastRefill = Date.now()
		} else {
			this.tokens = capacity
			this.lastRefill = Date.now()
		}
	}

	#save() {
		localStorage.setItem(this.storageKey, JSON.stringify({
			tokens: this.tokens,
			lastRefill: this.lastRefill
		}))
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

const oapiBucket = new TokenBucket(
	OAPI_REQ_PER_MIN,               // bucket capacity (max requests)
	OAPI_REQ_PER_MIN / 60, 			// refill rate per sec
	'emcdynmapplus-oapi-bucket'		// localStorage key
)

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
		await oapiBucket.take()
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