import i18n from "i18next";
import moment from "moment";
import { initReactI18next } from "react-i18next";
import "moment/locale/zh-cn";

import enCommon from "./locales/en/common.json";
import enErrors from "./locales/en/errors.json";
import enPrint from "./locales/en/print.json";
import enSettings from "./locales/en/settings.json";
import enSidebar from "./locales/en/sidebar.json";
import enToolbar from "./locales/en/toolbar.json";
import enUpdates from "./locales/en/updates.json";

import zhCnCommon from "./locales/zh-cn/common.json";
import zhCnErrors from "./locales/zh-cn/errors.json";
import zhCnPrint from "./locales/zh-cn/print.json";
import zhCnSettings from "./locales/zh-cn/settings.json";
import zhCnSidebar from "./locales/zh-cn/sidebar.json";
import zhCnToolbar from "./locales/zh-cn/toolbar.json";
import zhCnUpdates from "./locales/zh-cn/updates.json";

const resources = {
	en: {
		common: enCommon,
		sidebar: enSidebar,
		toolbar: enToolbar,
		settings: enSettings,
		print: enPrint,
		errors: enErrors,
		updates: enUpdates,
	},
	"zh-cn": {
		common: zhCnCommon,
		sidebar: zhCnSidebar,
		toolbar: zhCnToolbar,
		settings: zhCnSettings,
		print: zhCnPrint,
		errors: zhCnErrors,
		updates: zhCnUpdates,
	},
};

const LOCALE_STORAGE_KEY = "locale";

function getInitialLanguage(): "en" | "zh-cn" {
	// Default to zh-cn; actual persisted locale is applied via appStore
	return "zh-cn";
}

export const supportedLocales = ["en", "zh-cn"] as const;
export type Locale = (typeof supportedLocales)[number];

export function setMomentLocale(lng: string): void {
	const momentLng = lng === "zh-cn" ? "zh-cn" : "en";
	moment.locale(momentLng);
}

const initialLng = getInitialLanguage();

// 使用同步初始化：initImmediate: false
i18n.use(initReactI18next).init({
	resources,
	lng: initialLng,
	fallbackLng: "en",
	defaultNS: "common",
	interpolation: {
		escapeValue: false,
	},
	debug: false, // 关闭调试
	initImmediate: false, // 同步初始化，确保在组件渲染前完成
	// 关键修复：强制使用小写语言代码
	// 默认情况下 i18next 会将 "zh-cn" 规范化为 "zh-CN"，导致找不到小写的资源键
	lowerCaseLng: true, // 强制语言代码小写
	load: "currentOnly", // 只加载当前语言，不进行语言查找链
	react: {
		useSuspense: false, // 避免 Suspense 导致的延迟
	},
});

setMomentLocale(i18n.language);

i18n.on("languageChanged", (lng) => {
	setMomentLocale(lng);
});

export { LOCALE_STORAGE_KEY };
export default i18n;
