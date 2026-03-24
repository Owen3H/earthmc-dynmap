const { fetch: originalFetch } = window;
const LOG_PREFIX = "emcdynmapplus[page]";
const MARKER_EVENT_TIMEOUT_MS = 5000;
let markerRequestId = 0;

function isDebugLoggingEnabled() {
	try {
		return localStorage["emcdynmapplus-debug"] === "true";
	} catch {
		return false;
	}
}

const debugInfo = (...args) => {
	if (isDebugLoggingEnabled()) console.info(...args);
};

function cloneSerializable(value) {
	if (typeof value === "undefined") return undefined;

	try {
		return JSON.parse(JSON.stringify(value));
	} catch {
		try {
			if (typeof structuredClone === "function") return structuredClone(value);
		} catch {}

		return null;
	}
}

function parseEventDetail(detail) {
	if (typeof detail === "string") {
		try {
			return JSON.parse(detail);
		} catch (err) {
			console.warn(`${LOG_PREFIX}: failed to parse string event detail`, err);
			return null;
		}
	}

	return cloneSerializable(detail);
}

function getRequestUrl(input) {
	try {
		if (typeof input === "string") return input;
		if (input instanceof URL) return input.toString();
		if (input instanceof Request && typeof input.url === "string")
			return input.url;
		if (input && typeof input.url === "string") return input.url;
	} catch {}

	return "";
}

function getResponseUrl(response, fallback = "") {
	try {
		if (typeof response?.url === "string" && response.url.length > 0)
			return response.url;
	} catch {}

	return fallback;
}

// Replace the default fetch() with ours to intercept responses
window.fetch = async (...args) => {
	const requestUrl = getRequestUrl(args[0]);

	try {
		const response = await originalFetch(...args);
		const responseUrl = getResponseUrl(response, requestUrl);
		if (!response.ok && response.status != 304) return response;
		if (responseUrl.includes("web.archive.org")) return response;

		const isMarkers = responseUrl.includes("markers.json");
		const isSettings = responseUrl.includes(
			"minecraft_overworld/settings.json",
		);
		if (!isMarkers && !isSettings) return response;

		debugInfo(
			`${LOG_PREFIX}: intercepted ${isMarkers ? "markers" : "settings"} response`,
			{
				url: responseUrl,
				status: response.status,
			},
		);

		const start = performance.now();
		const data = await response
			.clone()
			.json()
			.catch((e) => {
				console.error(`${LOG_PREFIX}: failed to parse intercepted JSON`, e);
				return null;
			});
		if (data == null) {
			console.warn(
				`${LOG_PREFIX}: intercepted payload was null, returning original response`,
				{ url: responseUrl },
			);
			return response;
		}

		if (isSettings) {
			// `response.json()` already yields plain JSON data, so avoid an extra deep clone here.
			const modifiedData = modifySettings(data);
			if (modifiedData == null) {
				console.warn(
					`${LOG_PREFIX}: settings modification returned unserializable data, returning original response`,
					{ url: responseUrl },
				);
				return response;
			}

			const elapsed = performance.now() - start;
			debugInfo(`${LOG_PREFIX}: modified settings response`, {
				url: responseUrl,
				elapsedMs: Number(elapsed.toFixed(2)),
			});

			return new Response(JSON.stringify(modifiedData), {
				status: response.status,
				statusText: response.statusText,
				headers: response.headers,
			});
		}

		const requestId = ++markerRequestId;
		const markerModifier = window.EMCDYNMAPPLUS_PAGE_MARKERS?.modifyMarkers;
		if (typeof markerModifier !== "function") {
			console.warn(`${LOG_PREFIX}: marker modifier is unavailable, returning original response`, {
				id: requestId,
				url: responseUrl,
			});
			return response;
		}

		debugInfo(`${LOG_PREFIX}: dispatching markers event to page marker engine`, {
			id: requestId,
			url: responseUrl,
			layerCount: Array.isArray(data) ? data.length : null,
			markerCount: Array.isArray(data?.[0]?.markers)
				? data[0].markers.length
				: null,
		});
		const modifiedData = await Promise.race([
			markerModifier(data),
			new Promise((resolve) => setTimeout(() => resolve(null), MARKER_EVENT_TIMEOUT_MS)),
		]);
		if (modifiedData == null) {
			console.warn(
				`${LOG_PREFIX}: marker engine returned no data, returning original response`,
				{
					id: requestId,
					url: responseUrl,
					timeoutMs: MARKER_EVENT_TIMEOUT_MS,
				},
			);
			return response;
		}

		const elapsed = performance.now() - start;
		debugInfo(`${LOG_PREFIX}: returning modified markers response`, {
			id: requestId,
			url: responseUrl,
			elapsedMs: Number(elapsed.toFixed(2)),
			layerCount: Array.isArray(modifiedData)
				? modifiedData.length
				: null,
			markerCount: Array.isArray(modifiedData?.[0]?.markers)
				? modifiedData[0].markers.length
				: null,
		});

		return new Response(JSON.stringify(modifiedData), {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers,
		});
	} catch (err) {
		console.error(
			`${LOG_PREFIX}: fetch interception failed, falling back to original fetch`,
			{
				url: requestUrl,
				error: err,
			},
		);
		return originalFetch(...args);
	}
};

/** @param {Object} data - The settings response JSON data. */
function modifySettings(data) {
	// Set camera on Europe and zoom all the way out
	data.spawn = { x: 3400, z: -8800 };
	data.zoom.def = 0;

	data["player_tracker"].nameplates["heads_url"] =
		"https://mc-heads.net/avatar/{uuid}/16";
	data["player_tracker"].nameplates["show_heads"] = true;

	// I think these are all disabled server side but may as well ;)
	data["player_tracker"].update_interval = 5;
	data["player_tracker"].nameplates["show_health"] = true;
	data["player_tracker"].nameplates["show_armor"] = true;
	data["player_tracker"].nameplates["show_effects"] = true;

	return data;
}

document.addEventListener("EMCDYNMAPPLUS_ADJUST_SCROLL", (e) => {
	let adjustedZoom = null;
	try {
		if (typeof e.detail === "number" && Number.isFinite(e.detail))
			adjustedZoom = e.detail;
		else if (
			typeof e.detail?.pxPerZoomLevel === "number" &&
			Number.isFinite(e.detail.pxPerZoomLevel)
		) {
			adjustedZoom = e.detail.pxPerZoomLevel;
		}
	} catch (err) {
		console.warn(`${LOG_PREFIX}: could not read adjusted zoom detail`, err);
		return;
	}

	if (adjustedZoom == null) return;

	// Apply the zoom sensitivity adjustment via Leaflet
	if (window.L && window.L.Map) {
		window.L.Map.mergeOptions({ wheelPxPerZoomLevel: adjustedZoom });
	}
});
