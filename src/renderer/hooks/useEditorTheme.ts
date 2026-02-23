import { Compartment } from "@codemirror/state";
import { useCallback, useMemo, useRef } from "react";
import { createCMThemeFromEditorTheme } from "../lib/codemirror-themes/create-cm-theme";
import { useTheme } from "../lib/theme-system/use-theme";

export function useEditorTheme() {
	const { editorTheme, isDark } = useTheme();
	const themeCompartmentRef = useRef<Compartment>(new Compartment());

	const createThemeExtension = useCallback(() => {
		return createCMThemeFromEditorTheme(editorTheme, isDark);
	}, [editorTheme, isDark]);

	const themeExtension = useMemo(() => {
		return createThemeExtension();
	}, [createThemeExtension]);

	return {
		isDark,
		themeCompartment: themeCompartmentRef.current,
		createThemeExtension,
		themeExtension,
	};
}
