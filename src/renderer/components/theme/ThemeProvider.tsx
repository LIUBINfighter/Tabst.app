import { useEffect } from 'react';
import { useTheme } from '../../lib/theme-system/use-theme';

interface ThemeProviderProps {
	children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
	const { uiTheme } = useTheme();

	useEffect(() => {
		if (typeof document === 'undefined') return;

		const root = document.documentElement;
		const isDark = uiTheme.variant === 'dark';

		if (isDark) {
			root.classList.add('dark');
		} else {
			root.classList.remove('dark');
		}
	}, [uiTheme]);

	return <>{children}</>;
}
