import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Builder, By, until } from "selenium-webdriver";
import firefox from "selenium-webdriver/firefox.js";

const MAP_URL = "https://map.earthmc.net/";
const ARCHIVE_DATE = "20251103";
const ARCHIVE_LABEL_DATE = "2025-11-03";
const XPI_PATH = path.resolve("dist", "emc-dynmapplus-firefox.xpi");
const PAGE_LOAD_TIMEOUT_MS = 30000;
const SIDEBAR_TIMEOUT_MS = 15000;

function pathIfExists(candidate) {
	return candidate && fs.existsSync(candidate) ? candidate : null;
}

function findOnPath(executableNames) {
	const pathEntries = (process.env.PATH || "")
		.split(path.delimiter)
		.map((entry) => entry.trim())
		.filter(Boolean);

	for (const entry of pathEntries) {
		for (const executableName of executableNames) {
			const candidate = path.join(entry, executableName);
			if (fs.existsSync(candidate)) return candidate;
		}
	}

	return null;
}

function findLatestGeckoDriverFromSeleniumCache() {
	const baseDir = path.join(os.homedir(), ".cache", "selenium", "geckodriver");
	if (!fs.existsSync(baseDir)) return null;

	for (const platformEntry of fs.readdirSync(baseDir, { withFileTypes: true })) {
		if (!platformEntry.isDirectory()) continue;

		const platformDir = path.join(baseDir, platformEntry.name);
		const versionDirs = fs
			.readdirSync(platformDir, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));

		for (const versionDir of versionDirs) {
			const candidate = path.join(platformDir, versionDir, "geckodriver.exe");
			if (fs.existsSync(candidate)) return candidate;
		}
	}

	return null;
}

function resolveFirefoxBinaryPath() {
	const candidates = [
		process.env.FIREFOX_BINARY,
		process.env.FIREFOX_BINARY_PATH,
		process.env.ProgramFiles
			? path.join(process.env.ProgramFiles, "Mozilla Firefox", "firefox.exe")
			: null,
		process.env["ProgramFiles(x86)"]
			? path.join(
					process.env["ProgramFiles(x86)"],
					"Mozilla Firefox",
					"firefox.exe",
				)
			: null,
		findOnPath(["firefox.exe", "firefox"]),
	];

	return candidates.map(pathIfExists).find(Boolean) ?? null;
}

function resolveGeckoDriverPath() {
	const candidates = [
		process.env.GECKODRIVER,
		process.env.GECKODRIVER_PATH,
		process.env.LOCALAPPDATA
			? path.join(
					process.env.LOCALAPPDATA,
					"Microsoft",
					"WinGet",
					"Links",
					"geckodriver.exe",
				)
			: null,
		findLatestGeckoDriverFromSeleniumCache(),
		findOnPath(["geckodriver.exe", "geckodriver"]),
	];

	return candidates.map(pathIfExists).find(Boolean) ?? null;
}

if (!fs.existsSync(XPI_PATH)) {
	throw new Error(
		`Missing Firefox package: ${XPI_PATH}. Run "npm run extension:firefox" first.`,
	);
}

const FIREFOX_BINARY_PATH = resolveFirefoxBinaryPath();
const geckoDriverPath = resolveGeckoDriverPath();

if (!FIREFOX_BINARY_PATH) {
	throw new Error(
		`Could not find Firefox binary. Set FIREFOX_BINARY or FIREFOX_BINARY_PATH if Firefox is installed in a custom location.`,
	);
}

if (!geckoDriverPath) {
	throw new Error(
		`Could not find geckodriver. Set GECKODRIVER or GECKODRIVER_PATH if geckodriver is installed in a custom location.`,
	);
}

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

async function tryAttachConsoleCapture(driver, logs) {
	if (typeof driver.onLogEvent !== "function") return false;

	await driver.onLogEvent((entry) => {
		const text =
			typeof entry === "string"
				? entry
				: entry?.text || entry?.message || JSON.stringify(entry);
		logs.push(text);
	});

	return true;
}

async function getNavigationDiagnostics(driver) {
	const diagnostics = {
		currentUrl: null,
		readyState: null,
		hasSidebar: null,
		localStorageAccessible: null,
		domCounts: null,
		error: null,
	};

	try {
		diagnostics.currentUrl = await driver.getCurrentUrl();
	} catch (err) {
		diagnostics.currentUrl = `error: ${err.message}`;
	}

	try {
		const scriptData = await driver.executeScript(`
			let localStorageAccessible = false;
			try {
				localStorageAccessible = !!localStorage;
			} catch (err) {
				localStorageAccessible = false;
			}

			return {
				href: window.location.href,
				readyState: document.readyState,
				hasSidebar: !!document.querySelector('#sidebar'),
				localStorageAccessible,
				domCounts: {
					extensionSidebar: document.querySelectorAll('.leaflet-top.leaflet-left > #sidebar').length,
					pageSidebar: document.querySelectorAll('body > #sidebar').length,
					serverInfo: document.querySelectorAll('#server-info').length,
					archiveLabels: document.querySelectorAll('#current-map-mode-label').length,
					alerts: document.querySelectorAll('#alert').length,
					scripts: document.scripts.length,
				},
			};
		`);

		diagnostics.currentUrl = scriptData?.href ?? diagnostics.currentUrl;
		diagnostics.readyState = scriptData?.readyState ?? null;
		diagnostics.hasSidebar = scriptData?.hasSidebar ?? null;
		diagnostics.localStorageAccessible = scriptData?.localStorageAccessible ?? null;
		diagnostics.domCounts = scriptData?.domCounts ?? null;
	} catch (err) {
		diagnostics.error = err.message;
	}

	return diagnostics;
}

async function getUiSnapshot(driver) {
	return driver.executeScript(`
		return {
			href: window.location.href,
			readyState: document.readyState,
			timeOrigin: performance.timeOrigin,
			mapMode: localStorage.getItem('emcdynmapplus-mapmode'),
			archiveDate: localStorage.getItem('emcdynmapplus-archive-date'),
			archiveLabels: Array.from(document.querySelectorAll('#current-map-mode-label')).map(el => el.textContent || ''),
			archiveLabelCount: document.querySelectorAll('#current-map-mode-label').length,
			extensionSidebarCount: document.querySelectorAll('.leaflet-top.leaflet-left > #sidebar').length,
			pageSidebarCount: document.querySelectorAll('body > #sidebar').length,
			serverInfoCount: document.querySelectorAll('#server-info').length,
			nationClaimsCount: document.querySelectorAll('#nation-claims').length,
			alertCount: document.querySelectorAll('#alert').length,
		}
	`);
}

async function getMarkersSummary(driver) {
	return driver.executeAsyncScript(`
		const done = arguments[arguments.length - 1];
		fetch('/tiles/minecraft_overworld/markers.json', { cache: 'no-store' })
			.then(async response => {
				const data = await response.json();
				const markerLayer = Array.isArray(data)
					? data.find(layer => layer?.id === 'towny' && Array.isArray(layer?.markers))
						|| data.find(layer => Array.isArray(layer?.markers))
					: null;
				done({
					ok: true,
					layerCount: Array.isArray(data) ? data.length : null,
					markerCount: markerLayer ? markerLayer.markers.length : null,
					markerLayerId: markerLayer?.id ?? null,
					layerIds: Array.isArray(data) ? data.map(layer => layer?.id ?? null) : [],
				});
			})
			.catch(error => {
				done({
					ok: false,
					error: String(error),
				});
			});
	`);
}

const options = new firefox.Options();
options.setPreference("devtools.console.stdout.content", true);
options.setBinary(FIREFOX_BINARY_PATH);
options.addArguments("-headless");
options.setPageLoadStrategy("eager");

const service = new firefox.ServiceBuilder(geckoDriverPath);
service.enableVerboseLogging();
service.setStdio("inherit");

const driver = await new Builder()
	.forBrowser("firefox")
	.setFirefoxOptions(options)
	.setFirefoxService(service)
	.build();

const logs = [];

try {
	let hasLiveLogCapture = false;

	try {
		hasLiveLogCapture = await tryAttachConsoleCapture(driver, logs);
	} catch (err) {
		console.warn(
			"Console capture unavailable in this Firefox Selenium setup:",
			err.message,
		);
	}

	const addonId = await driver.installAddon(XPI_PATH, true);
	console.log("Installed addon:", addonId);

	await driver.manage().setTimeouts({
		pageLoad: PAGE_LOAD_TIMEOUT_MS,
		script: PAGE_LOAD_TIMEOUT_MS,
	});

	console.log("Starting navigation:", {
		url: MAP_URL,
		pageLoadStrategy: "eager",
		pageLoadTimeoutMs: PAGE_LOAD_TIMEOUT_MS,
	});

	try {
		await driver.get(MAP_URL);
		console.log("Navigation returned from driver.get");
		console.log("Navigation diagnostics after driver.get:", await getNavigationDiagnostics(driver));
	} catch (err) {
		console.error("Navigation failed or timed out during driver.get:", {
			name: err.name,
			message: err.message,
		});
		const diagnostics = await getNavigationDiagnostics(driver);
		console.log("Navigation diagnostics after driver.get failure:", diagnostics);

		if (!(diagnostics.hasSidebar || diagnostics.readyState === "interactive" || diagnostics.readyState === "complete")) {
			throw err;
		}

		console.warn("Proceeding after navigation failure because partial page state is available.");
	}

	try {
		await driver.wait(until.elementLocated(By.css("#sidebar")), SIDEBAR_TIMEOUT_MS);
		console.log("Sidebar located after navigation.");
	} catch (err) {
		console.error("Sidebar did not appear after navigation:", {
			name: err.name,
			message: err.message,
		});
		console.log("Navigation diagnostics after sidebar wait failure:", await getNavigationDiagnostics(driver));
		throw err;
	}

	const liveSnapshot = await getUiSnapshot(driver);
	console.log("Initial live UI snapshot:", liveSnapshot);

	const liveMarkers = await getMarkersSummary(driver);
	console.log("Initial live markers summary:", liveMarkers);

	await driver.executeScript(
		`
			localStorage.setItem('emcdynmapplus-mapmode', 'archive');
			localStorage.setItem('emcdynmapplus-archive-date', arguments[0]);
		`,
		ARCHIVE_DATE,
	);

	console.log("Archive state written to localStorage:", {
		mapMode: "archive",
		archiveDate: ARCHIVE_DATE,
	});

	await driver.navigate().refresh();

	await driver.wait(
		async () => {
			const text = await driver.executeScript(
				`return document.querySelector('#current-map-mode-label')?.textContent ?? ''`,
			);
			return text.includes(ARCHIVE_LABEL_DATE);
		},
		15000,
		"Archive label never showed requested archive date.",
	);

	const archiveLabelSnapshot = await getUiSnapshot(driver);
	console.log("Archive label appeared snapshot:", archiveLabelSnapshot);

	const archiveMarkersFirst = await getMarkersSummary(driver);
	console.log("First archive markers summary:", archiveMarkersFirst);

	const timeline = [];
	for (let i = 1; i <= 7; i++) {
		await driver.sleep(1000);
		const snapshot = await getUiSnapshot(driver);
		timeline.push(snapshot);
		console.log(`Archive timeline snapshot ${i}:`, snapshot);
	}

	const archiveMarkersSecond = await getMarkersSummary(driver);
	console.log("Second archive markers summary:", archiveMarkersSecond);

	const finalLabel = await driver.executeScript(
		`return document.querySelector('#current-map-mode-label')?.textContent ?? ''`,
	);

	assert(
		finalLabel.includes(ARCHIVE_LABEL_DATE),
		`Archive label did not persist. Final label: ${finalLabel}`,
	);
	assert(
		archiveLabelSnapshot.archiveLabelCount === 1,
		`Archive UI rendered duplicate labels immediately after load. count=${archiveLabelSnapshot.archiveLabelCount}`,
	);

	assert(
		liveMarkers.ok,
		`Failed to fetch live markers summary: ${liveMarkers.error || "unknown error"}`,
	);
	assert(
		archiveMarkersFirst.ok,
		`Failed to fetch first archive markers summary: ${archiveMarkersFirst.error || "unknown error"}`,
	);
	assert(
		archiveMarkersSecond.ok,
		`Failed to fetch second archive markers summary: ${archiveMarkersSecond.error || "unknown error"}`,
	);

	assert(
		archiveMarkersFirst.markerCount !== liveMarkers.markerCount,
		`Archive markers did not differ from live markers. live=${liveMarkers.markerCount}, archive=${archiveMarkersFirst.markerCount}`,
	);

	assert(
		archiveMarkersSecond.markerCount === archiveMarkersFirst.markerCount,
		`Archive marker count did not persist. first=${archiveMarkersFirst.markerCount}, second=${archiveMarkersSecond.markerCount}`,
	);
	assert(
		!finalLabel.includes(`(${ARCHIVE_LABEL_DATE}) (${ARCHIVE_LABEL_DATE})`),
		`Archive label duplicated the archive date in the final UI. finalLabel=${finalLabel}`,
	);

	if (hasLiveLogCapture) {
		const joined = logs.join("\n");

		if (joined.includes("timed out waiting for modified markers event")) {
			throw new Error(
				"Archive bridge timed out and likely fell back to live markers.",
			);
		}

		if (
			joined.includes("markers were not modified, returning original response")
		) {
			throw new Error("Archive markers fell back to original live markers.");
		}
	} else {
		console.warn(
			"Live Firefox console capture is unavailable in this Selenium setup.",
		);
		console.warn(
			"This run asserted DOM-visible archive state and marker payload stability.",
		);
	}

	const timelineOrigins = [...new Set(timeline.map((snapshot) => snapshot.timeOrigin))];
	const duplicateLabelFrames = timeline.filter((snapshot) => snapshot.archiveLabelCount > 1);
	const duplicateExtensionSidebarFrames = timeline.filter(
		(snapshot) => snapshot.extensionSidebarCount > 1,
	);

	console.log("Archive timeline summary:", {
		uniqueTimeOrigins: timelineOrigins,
		duplicateLabelFrames: duplicateLabelFrames.length,
		duplicateExtensionSidebarFrames: duplicateExtensionSidebarFrames.length,
		finalLabel,
		liveMarkerCount: liveMarkers.markerCount,
		archiveMarkerCountFirst: archiveMarkersFirst.markerCount,
		archiveMarkerCountSecond: archiveMarkersSecond.markerCount,
	});

	console.log("Archive persistence check passed.");
} finally {
	await driver.quit();
}
