/** Browser extension compatibility helpers shared by Chromium and Firefox. */
const extensionRuntime = globalThis.browser?.runtime ?? globalThis.chrome?.runtime ?? null

function isFirefoxBrowser() {
	return /Firefox\//.test(globalThis.navigator?.userAgent || '')
}

/** @returns {Manifest} */
function getExtensionManifest() {
	if (isUserscript()) return MANIFEST
	if (!extensionRuntime?.getManifest) throw new Error('Extension runtime manifest API is unavailable.')

	return extensionRuntime.getManifest()
}

/** @param {string} resource */
function getExtensionURL(resource) {
	if (isUserscript()) return resource
	if (!extensionRuntime?.getURL) throw new Error('Extension runtime URL API is unavailable.')

	return extensionRuntime.getURL(resource)
}

/** @param {Manifest} manifest */
function getWebAccessibleResourceList(manifest) {
	const [firstEntry] = manifest.web_accessible_resources || []
	if (Array.isArray(firstEntry)) return firstEntry

	return firstEntry?.resources || []
}

function cloneSerializable(value) {
	if (typeof value === 'undefined') return undefined

	try {
		return JSON.parse(JSON.stringify(value))
	} catch {
		try {
			if (typeof structuredClone === 'function') return structuredClone(value)
		} catch {}

		return null
	}
}
