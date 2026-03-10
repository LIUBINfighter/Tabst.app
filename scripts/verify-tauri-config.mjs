import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function readJson(relativePath) {
	const filePath = path.join(root, relativePath);
	return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensure(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

function tokenize(value) {
	if (Array.isArray(value)) {
		return value.flatMap(tokenize);
	}
	if (typeof value !== "string") {
		return [];
	}
	return value.split(/\s+/).filter(Boolean);
}

function includesToken(value, token) {
	return tokenize(value).includes(token);
}

function verifyCspObject(name, csp, { allowDevEval = false, requireDevHost = false } = {}) {
	ensure(csp && typeof csp === "object" && !Array.isArray(csp), `${name} must be a CSP object`);
	ensure(csp["default-src"], `${name} must define default-src`);
	ensure(csp["script-src"], `${name} must define script-src`);
	ensure(csp["style-src"], `${name} must define style-src`);
	ensure(csp["connect-src"], `${name} must define connect-src`);
	ensure(csp["img-src"], `${name} must define img-src`);
	ensure(csp["font-src"], `${name} must define font-src`);
	ensure(csp["media-src"], `${name} must define media-src`);
	ensure(csp["worker-src"], `${name} must define worker-src`);
	ensure(includesToken(csp["default-src"], "'self'"), `${name} default-src must include 'self'`);
	ensure(includesToken(csp["object-src"], "'none'"), `${name} object-src must be locked down`);
	ensure(
		includesToken(csp["frame-ancestors"], "'none'"),
		`${name} frame-ancestors must be locked down`,
	);
	ensure(
		includesToken(csp["connect-src"], "ipc:") && includesToken(csp["connect-src"], "http://ipc.localhost"),
		`${name} connect-src must allow Tauri IPC`,
	);
	ensure(includesToken(csp["worker-src"], "'self'"), `${name} worker-src must allow same-origin workers`);
	ensure(includesToken(csp["style-src"], "'unsafe-inline'"), `${name} style-src must allow inline styles`);
	if (!allowDevEval) {
		ensure(!includesToken(csp["script-src"], "'unsafe-eval'"), `${name} script-src must not allow unsafe-eval`);
	}
	ensure(!includesToken(csp["script-src"], "'unsafe-inline'"), `${name} script-src must not allow unsafe-inline`);

	if (requireDevHost) {
		ensure(
			includesToken(csp["connect-src"], "http://127.0.0.1:7777") &&
				includesToken(csp["connect-src"], "ws://127.0.0.1:7777"),
			`${name} connect-src must allow the local Vite dev server`,
		);
	}
}

function verifyCapability(identifier, capability, expected) {
	ensure(capability.identifier === identifier, `${identifier} identifier mismatch`);
	ensure(
		JSON.stringify(capability.windows) === JSON.stringify(expected.windows),
		`${identifier} windows must be ${expected.windows.join(", ")}`,
	);

	for (const permission of expected.mustInclude) {
		ensure(capability.permissions.includes(permission), `${identifier} must include ${permission}`);
	}

	for (const permission of expected.mustExclude) {
		ensure(!capability.permissions.includes(permission), `${identifier} must not include ${permission}`);
	}
}

function main() {
	const tauriConfig = readJson("src-tauri/tauri.conf.json");
	const mainCapability = readJson("src-tauri/capabilities/default.json");
	const printCapability = readJson("src-tauri/capabilities/print.json");

	verifyCspObject("app.security.csp", tauriConfig.app?.security?.csp);
	verifyCspObject("app.security.devCsp", tauriConfig.app?.security?.devCsp, {
		allowDevEval: true,
		requireDevHost: true,
	});

	verifyCapability("main-capability", mainCapability, {
		windows: ["main"],
		mustInclude: [
			"core:default",
			"core:webview:allow-create-webview-window",
			"core:window:allow-create",
		],
		mustExclude: ["core:webview:allow-print"],
	});

	verifyCapability("print-capability", printCapability, {
		windows: ["print"],
		mustInclude: ["core:default", "core:webview:allow-print"],
		mustExclude: ["core:webview:allow-create-webview-window", "core:window:allow-create"],
	});

	console.log("Tauri security configuration verified.");
}

main();
