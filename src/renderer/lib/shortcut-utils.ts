import { type GlobalCommandId, getGlobalCommands } from "./command-registry";

export type CommandShortcutOverrides = Record<string, string[]>;

export const DEFAULT_COMMAND_SHORTCUTS: Partial<
	Record<GlobalCommandId, string[]>
> = {
	"open-quick-file": ["mod+o"],
	"open-editor-command-palette": ["mod+p"],
	"workspace.global-command-palette.open": ["mod+shift+p"],
};

const MAC_PLATFORM_REGEX = /Mac|iPhone|iPad|iPod/i;
const MODIFIER_TOKENS = new Set(["mod", "alt", "shift"]);
const MODIFIER_TOKEN_ORDER = ["mod", "alt", "shift"] as const;
const STANDALONE_MODIFIER_KEYS = new Set(["meta", "ctrl", "alt", "shift"]);

const TOKEN_ALIASES: Record<string, string> = {
	cmd: "mod",
	command: "mod",
	ctrl: "mod",
	control: "mod",
	meta: "mod",
	option: "alt",
	escape: "esc",
	return: "enter",
	spacebar: "space",
	arrowup: "up",
	arrowdown: "down",
	arrowleft: "left",
	arrowright: "right",
};

function normalizeToken(rawToken: string): string {
	const token = rawToken.trim().toLowerCase();
	if (!token) return "";
	if (token === " ") return "space";
	return TOKEN_ALIASES[token] ?? token;
}

function unique<T>(items: T[]): T[] {
	const next: T[] = [];
	for (const item of items) {
		if (!next.includes(item)) {
			next.push(item);
		}
	}
	return next;
}

export function normalizeShortcut(shortcut: string): string {
	const parts = shortcut
		.split("+")
		.map((token) => normalizeToken(token))
		.filter(Boolean);

	if (parts.length === 0) return "";

	const modifiers = unique(
		parts.filter((token) => MODIFIER_TOKENS.has(token)),
	).sort((left, right) => {
		return (
			MODIFIER_TOKEN_ORDER.indexOf(
				left as (typeof MODIFIER_TOKEN_ORDER)[number],
			) -
			MODIFIER_TOKEN_ORDER.indexOf(
				right as (typeof MODIFIER_TOKEN_ORDER)[number],
			)
		);
	});

	const keyToken = [...parts]
		.reverse()
		.find((token) => !MODIFIER_TOKENS.has(token));

	if (!keyToken) return "";
	return [...modifiers, keyToken].join("+");
}

export function sanitizeShortcutList(shortcuts: string[]): string[] {
	const normalized = shortcuts
		.map((shortcut) => normalizeShortcut(shortcut))
		.filter(Boolean);
	return unique(normalized);
}

export function getShortcutFromKeyboardEvent(
	event: KeyboardEvent,
): string | null {
	const keyToken = normalizeToken(event.key);
	if (!keyToken || STANDALONE_MODIFIER_KEYS.has(keyToken)) return null;

	const tokens: string[] = [];
	if (event.metaKey || event.ctrlKey) {
		tokens.push("mod");
	}
	if (event.altKey) {
		tokens.push("alt");
	}
	if (event.shiftKey) {
		tokens.push("shift");
	}
	tokens.push(keyToken);

	return normalizeShortcut(tokens.join("+"));
}

export function isMacPlatform(): boolean {
	if (typeof navigator === "undefined") return false;
	return MAC_PLATFORM_REGEX.test(navigator.platform);
}

function toDisplayKey(shortcutKey: string, isMac: boolean): string {
	if (shortcutKey === "esc") return isMac ? "⎋" : "Esc";
	if (shortcutKey === "enter") return isMac ? "↩" : "Enter";
	if (shortcutKey === "space") return isMac ? "␣" : "Space";
	if (shortcutKey === "tab") return isMac ? "⇥" : "Tab";
	if (shortcutKey === "up") return isMac ? "↑" : "Up";
	if (shortcutKey === "down") return isMac ? "↓" : "Down";
	if (shortcutKey === "left") return isMac ? "←" : "Left";
	if (shortcutKey === "right") return isMac ? "→" : "Right";
	if (shortcutKey.length === 1) return shortcutKey.toUpperCase();
	return shortcutKey.charAt(0).toUpperCase() + shortcutKey.slice(1);
}

export function formatShortcut(shortcut: string): string {
	const normalized = normalizeShortcut(shortcut);
	if (!normalized) return "";

	const tokens = normalized.split("+");
	const key = tokens[tokens.length - 1] ?? "";
	const modifiers = tokens.slice(0, -1);
	const mac = isMacPlatform();

	if (mac) {
		const prefix = modifiers
			.map((token) => {
				if (token === "mod") return "⌘";
				if (token === "alt") return "⌥";
				if (token === "shift") return "⇧";
				return token;
			})
			.join("");
		return `${prefix}${toDisplayKey(key, true)}`;
	}

	const prefix = modifiers.map((token) => {
		if (token === "mod") return "Ctrl";
		if (token === "alt") return "Alt";
		if (token === "shift") return "Shift";
		return token;
	});

	return [...prefix, toDisplayKey(key, false)].join("+");
}

export function isEditableTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;
	const tag = target.tagName;
	return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function getEffectiveCommandShortcuts(
	overrides: CommandShortcutOverrides,
): Record<GlobalCommandId, string[]> {
	const commands = getGlobalCommands();
	const next = {} as Record<GlobalCommandId, string[]>;

	for (const command of commands) {
		const overrideShortcuts = overrides[command.id];
		next[command.id] = Array.isArray(overrideShortcuts)
			? sanitizeShortcutList(overrideShortcuts)
			: sanitizeShortcutList(DEFAULT_COMMAND_SHORTCUTS[command.id] ?? []);
	}

	return next;
}

export function findCommandByShortcut(
	shortcut: string,
	effectiveShortcuts: Record<GlobalCommandId, string[]>,
): GlobalCommandId | null {
	const normalized = normalizeShortcut(shortcut);
	if (!normalized) return null;

	for (const command of getGlobalCommands()) {
		if (effectiveShortcuts[command.id].includes(normalized)) {
			return command.id;
		}
	}

	return null;
}
