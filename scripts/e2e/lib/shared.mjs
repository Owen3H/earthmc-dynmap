import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function pathIfExists(candidate) {
	return candidate && fs.existsSync(candidate) ? candidate : null;
}

export function findOnPath(executableNames) {
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

export function findLatestDriverFromSeleniumCache(driverName) {
	const baseDir = path.join(os.homedir(), ".cache", "selenium", driverName);
	if (!fs.existsSync(baseDir)) return null;

	for (const platformEntry of fs.readdirSync(baseDir, { withFileTypes: true })) {
		if (!platformEntry.isDirectory()) continue;

		const platformDir = path.join(baseDir, platformEntry.name);
		const versionDirs = fs
			.readdirSync(platformDir, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.sort((left, right) =>
				right.localeCompare(left, undefined, { numeric: true }),
			);

		for (const versionDir of versionDirs) {
			const candidates = [
				path.join(platformDir, versionDir, `${driverName}.exe`),
				path.join(platformDir, versionDir, driverName),
			];
			const match = candidates.map(pathIfExists).find(Boolean);
			if (match) return match;
		}
	}

	return null;
}

export function envFlagEnabled(value, defaultValue = true) {
	if (value == null) return defaultValue;
	return !["0", "false", "no", "off"].includes(String(value).toLowerCase());
}

export function assert(condition, message) {
	if (!condition) throw new Error(message);
}
