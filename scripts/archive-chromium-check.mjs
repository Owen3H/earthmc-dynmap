import { runE2E } from "./e2e/run.mjs";

const result = await runE2E({
	browser: "chromium",
	test: "archive",
});

if (!result.ok) {
	process.exitCode = 1;
}
