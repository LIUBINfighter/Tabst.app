import { describe, expect, it } from "vitest";

class FakeHTMLElement {
	constructor(
		public tagName = "DIV",
		public isContentEditable = false,
		private inCodeMirror = false,
		private parent: FakeHTMLElement | null = null,
	) {}

	closest(selector: string): FakeHTMLElement | null {
		if (selector === ".cm-editor" && this.inCodeMirror) return this;
		return this.parent?.closest(selector) ?? null;
	}
}

(globalThis as { HTMLElement?: unknown }).HTMLElement = FakeHTMLElement;

import { isEditableTarget } from "./shortcut-utils";

describe("isEditableTarget", () => {
	it("returns false for non-element targets", () => {
		expect(isEditableTarget(null)).toBe(false);
	});

	it("allows CodeMirror editor content so global shortcuts can fire", () => {
		const content = new FakeHTMLElement("DIV", true, true);
		expect(isEditableTarget(content)).toBe(false);
	});

	it("allows descendants inside the CodeMirror editor", () => {
		const editor = new FakeHTMLElement("DIV", false, true);
		const content = new FakeHTMLElement("DIV", true, false, editor);
		expect(isEditableTarget(content)).toBe(false);
	});

	it("blocks contenteditable elements outside CodeMirror", () => {
		const editable = new FakeHTMLElement("DIV", true, false);
		expect(isEditableTarget(editable)).toBe(true);
	});

	it("blocks input, textarea and select elements", () => {
		for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) {
			const element = new FakeHTMLElement(tagName, false);
			expect(isEditableTarget(element), tagName).toBe(true);
		}
	});

	it("allows plain elements", () => {
		const element = new FakeHTMLElement("BUTTON", false);
		expect(isEditableTarget(element)).toBe(false);
	});
});
