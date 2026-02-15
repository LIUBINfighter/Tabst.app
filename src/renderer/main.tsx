import ReactDOM from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import App from "./App";
import i18n from "./i18n";
import "./styles/index.css";
import { ThemeProvider } from "./components/theme";
import { ensureElectronApiInWebRuntime } from "./lib/web-electron-api";

ensureElectronApiInWebRuntime();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Failed to find the root element");

ReactDOM.createRoot(rootElement).render(
	<I18nextProvider i18n={i18n}>
		<ThemeProvider>
			<App />
		</ThemeProvider>
	</I18nextProvider>,
);
