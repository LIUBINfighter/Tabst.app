import ReactDOM from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import App from "./App";
import i18n from "./i18n";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Failed to find the root element");

// 初始化主题：优先使用 localStorage，如果没有则使用系统偏好
(() => {
	const root = document.documentElement;
	try {
		const saved = localStorage.getItem("theme");
		if (saved === "dark") {
			root.classList.add("dark");
		} else if (saved === "light") {
			root.classList.remove("dark");
		} else if (window.matchMedia?.("(prefers-color-scheme: dark)")?.matches) {
			root.classList.add("dark");
		}
	} catch {
		// ignore localStorage errors
	}
})();

// 暂时注释 React.StrictMode（可能引发双重渲染导致重复初始化），如需调试请还原并改进 useEffect 的清理逻辑
ReactDOM.createRoot(rootElement).render(
	// <React.StrictMode>
	<I18nextProvider i18n={i18n}>
		<App />
	</I18nextProvider>,
	// </React.StrictMode>
);
