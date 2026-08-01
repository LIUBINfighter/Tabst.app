import { describe, expect, it, vi } from "vitest";

// appStore 在模块加载时会尝试读取初始设置（走 window.desktopAPI），
// node 环境下会抛出并被 console.error 记录。mock 掉 global-settings
// 避免无谓的报错噪音；不要 stub window，否则 alphaTab 会走浏览器分支。
vi.mock("../lib/global-settings", () => ({
	loadGlobalSettings: async () => null,
	saveGlobalSettings: async () => undefined,
}));

import {
	COMMAND_CATEGORY_ORDER,
	type CommandCategory,
	type CommandIcon,
	commandCategoryLabel,
	getGlobalCommands,
	getInlineCommands,
} from "./command-registry";
import { getCommandAvailability } from "./ui-command-registry";

const VALID_CATEGORIES = new Set<CommandCategory>(COMMAND_CATEGORY_ORDER);

const VALID_ICONS: CommandIcon[] = [
	"command",
	"file",
	"tree",
	"sparkles",
	"key",
	"layout",
	"playback",
	"printer",
	"music",
];

function expectResolvedLocalizedText(value: string, context: string) {
	expect(value, `${context} must not be empty`).toBeTruthy();
	expect(value, `${context} must not leak the i18n key path`).not.toContain(
		"commandRegistry",
	);
	expect(value, `${context} must not fall back to the raw key`).not.toMatch(
		/\.label$|\.description$/,
	);
}

describe("command registry integrity", () => {
	it("keeps global command ids unique", () => {
		const ids = getGlobalCommands().map((command) => command.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("keeps inline command ids unique", () => {
		const ids = getInlineCommands().map((command) => command.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("resolves localized labels and descriptions for every global command", () => {
		for (const command of getGlobalCommands()) {
			expectResolvedLocalizedText(command.label, `label of ${command.id}`);
			expectResolvedLocalizedText(
				command.description,
				`description of ${command.id}`,
			);
		}
	});

	it("assigns a valid category and icon to every global command", () => {
		for (const command of getGlobalCommands()) {
			expect(
				VALID_CATEGORIES.has(command.category),
				`category of ${command.id}`,
			).toBe(true);
			expect(VALID_ICONS).toContain(command.icon);
			expect(command.keywords.length).toBeGreaterThan(0);
		}
	});

	it("resolves category labels for every category", () => {
		for (const category of COMMAND_CATEGORY_ORDER) {
			expectResolvedLocalizedText(
				commandCategoryLabel(category),
				`category label of ${category}`,
			);
		}
	});
});

describe("inline commands", () => {
	it("mirrors the global command set after the ATDOC insert family removal", () => {
		expect(getInlineCommands().map((command) => command.id)).toEqual(
			getGlobalCommands().map((command) => command.id),
		);
	});

	it("does not register any ATDOC insert command", () => {
		const ids = getGlobalCommands().map((command) => command.id);
		expect(
			ids.some((id) => id.startsWith("insert-atdoc")),
			"ATDOC insert commands must stay deregistered",
		).toBe(false);
	});
});

describe("command availability", () => {
	it("keeps git and cloud workspace modes unavailable (temporarily closed)", () => {
		expect(getCommandAvailability("workspace.mode.git").enabled).toBe(false);
		expect(getCommandAvailability("workspace.mode.cloud").enabled).toBe(false);
	});

	it("provides a localized reason for temporarily closed views", () => {
		const gitReason = getCommandAvailability("workspace.mode.git").reason;
		expect(gitReason).toBeTruthy();
		expect(gitReason).not.toContain("commandAvailability");
	});

	it("keeps workspace mode commands available by default", () => {
		expect(getCommandAvailability("workspace.mode.editor").enabled).toBe(true);
		expect(getCommandAvailability("workspace.mode.tutorial").enabled).toBe(
			true,
		);
		expect(getCommandAvailability("workspace.mode.settings").enabled).toBe(
			true,
		);
	});
});
