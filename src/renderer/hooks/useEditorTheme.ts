/**
 * Editor Theme Hook
 *
 * Manages dark mode observation and theme Compartment for CodeMirror editor.
 */

import { Compartment } from "@codemirror/state";
import { useCallback, useEffect, useRef, useState } from "react";
import { createThemeExtension } from "../lib/editor-extensions";

export function useEditorTheme() {
	const [isDark, setIsDark] = useState<boolean>(() => {
		if (typeof document === "undefined") return false;
		return document.documentElement.classList.contains("dark");
	});

	const themeCompartmentRef = useRef<Compartment>(new Compartment());

	useEffect(() => {
		if (typeof document === "undefined") return;
		const root = document.documentElement;
		const observer = new MutationObserver(() => {
			setIsDark(root.classList.contains("dark"));
		});
		observer.observe(root, { attributes: true, attributeFilter: ["class"] });
		return () => observer.disconnect();
	}, []);

	const createThemeExtensionMemo = useCallback(
		(dark: boolean) => createThemeExtension(dark),
		[],
	);

	return {
		isDark,
		themeCompartment: themeCompartmentRef.current,
		createThemeExtension: createThemeExtensionMemo,
	};
}
