import * as alphaTab from "@coderline/alphatab";
import ReactDOM from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import App from "./App";
import PrintWindow from "./components/PrintWindow";
import i18n from "./i18n";
import "./styles/index.css";
import { ThemeProvider } from "./components/theme";
import { installAlphaTabFontWarningFilter } from "./lib/alphatab-font-warning-filter";
import { ensureDesktopApiInRuntime } from "./lib/desktop-api";
import { isPrintWindowLocation } from "./lib/print-window";

ensureDesktopApiInRuntime();
installAlphaTabFontWarningFilter(alphaTab.Logger);

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Failed to find the root element");

const isPrintWindow = isPrintWindowLocation(window.location.href);

ReactDOM.createRoot(rootElement).render(
	<I18nextProvider i18n={i18n}>
		<ThemeProvider>{isPrintWindow ? <PrintWindow /> : <App />}</ThemeProvider>
	</I18nextProvider>,
);
