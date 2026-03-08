import { beforeEach, describe, expect, it, vi } from "vitest";

const { appZoom, uiCommands, shortcutUtils } = vi.hoisted(() => ({
	appZoom: {
		handleAppZoomShortcut: vi.fn<(event: KeyboardEvent) => boolean>(),
	},
	uiCommands: {
		runUiCommand: vi.fn(() => ({ ok: true })),
	},
	shortcutUtils: {
		findCommandByShortcut: vi.fn(() => null),
		getEffectiveCommandShortcuts: vi.fn(() => ({})),
		getShortcutFromKeyboardEvent: vi.fn(() => null),
		isEditableTarget: vi.fn(() => false),
	},
}));

vi.mock("./app-zoom", () => appZoom);
vi.mock("./ui-command-registry", () => uiCommands);
vi.mock("./shortcut-utils", () => shortcutUtils);
vi.mock("../store/appStore", () => ({
	useAppStore: {
		getState: () => ({
			commandShortcuts: {},
		}),
	},
}));

import { runShortcutEvent } from "./shortcut-manager";

describe("runShortcutEvent", () => {
	beforeEach(() => {
		appZoom.handleAppZoomShortcut.mockReset();
		uiCommands.runUiCommand.mockClear();
		shortcutUtils.findCommandByShortcut.mockClear();
		shortcutUtils.getEffectiveCommandShortcuts.mockClear();
		shortcutUtils.getShortcutFromKeyboardEvent.mockReset();
		shortcutUtils.getShortcutFromKeyboardEvent.mockReturnValue(null);
		shortcutUtils.isEditableTarget.mockClear();
	});

	it("handles app zoom shortcuts before command registry dispatch", () => {
		appZoom.handleAppZoomShortcut.mockReturnValue(true);
		const event = {
			ctrlKey: true,
			metaKey: false,
			altKey: false,
			shiftKey: false,
			key: "=",
			defaultPrevented: false,
			isComposing: false,
			repeat: false,
			target: null,
			preventDefault: vi.fn(),
		} as unknown as KeyboardEvent;

		expect(runShortcutEvent(event)).toBe(true);
		expect(appZoom.handleAppZoomShortcut).toHaveBeenCalledWith(event);
		expect(uiCommands.runUiCommand).not.toHaveBeenCalled();
	});
});
