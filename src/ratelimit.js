/** Token bucket rate limiter */
class TokenBucket {
	constructor(capacity, refillPerMs) {
		this.capacity = capacity
		this.tokens = capacity
		this.refillPerMs = refillPerMs
		this.lastRefill = Date.now()
		this.queue = [] // A queue of request functions
	}

	start() {
		setInterval(() => {
			if (!this.queue.length) return
			this.#refill()
			while (this.tokens >= 1 && this.queue.length) {
				this.tokens -= 1
				this.queue.shift()()
			}
		}, 50)
	}

	#refill() {
		const now = Date.now()
		const elapsed = now - this.lastRefill
		if (elapsed <= 0) return

		this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs)
		this.lastRefill = now
	}

	take = async () => new Promise(resolve => {
        const tryTake = () => {
            this.#refill()
            if (this.tokens >= 1) {
                this.tokens -= 1
                return resolve()
            }

            this.queue.push(tryTake)
        }

        tryTake()
    })
}