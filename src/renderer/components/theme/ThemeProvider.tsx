import { useEffect } from "react";
import { useTheme } from "../../lib/theme-system/use-theme";

interface ThemeProviderProps {
	children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
	const { isDark } = useTheme();

	useEffect(() => {
		if (typeof document === "undefined") return;

		const root = document.documentElement;

		if (isDark) {
			root.classList.add("dark");
		} else {
			root.classList.remove("dark");
		}
	}, [isDark]);

	return <>{children}</>;
}
