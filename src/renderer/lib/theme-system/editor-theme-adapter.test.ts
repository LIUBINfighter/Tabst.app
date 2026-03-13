import { describe, expect, it } from "vitest";
import { getEditorThemeForUi } from "./editor-theme-adapter";
import { getEditorTheme } from "./theme-registry";

describe("editor theme adapter", () => {
	it("keeps universal themes unchanged in light UI", () => {
		const theme = getEditorTheme("github");
		expect(theme).toBeDefined();
		if (!theme) {
			throw new Error("missing github editor theme");
		}

		expect(getEditorThemeForUi(theme, false)).toBe(theme);
	});

	it("keeps dark themes unchanged in dark UI", () => {
		const theme = getEditorTheme("nord");
		expect(theme).toBeDefined();
		if (!theme) {
			throw new Error("missing nord editor theme");
		}

		expect(getEditorThemeForUi(theme, true)).toBe(theme);
	});

	it("adapts dark-only themes for light UI readability", () => {
		const theme = getEditorTheme("nord");
		expect(theme).toBeDefined();
		if (!theme) {
			throw new Error("missing nord editor theme");
		}

		const adapted = getEditorThemeForUi(theme, false);

		expect(adapted).not.toBe(theme);
		expect(adapted.variant).toBe("universal");
		expect(adapted.colors.variable).toBe("hsl(var(--foreground))");
		expect(adapted.colors.bracket).toBe("hsl(var(--foreground))");
		expect(adapted.cmConfig?.foreground).toBe("hsl(var(--foreground))");
		expect(adapted.cmConfig?.selection).toBe("hsl(var(--primary) / 0.16)");
	});
});
