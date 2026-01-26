import {
	Info,
	Map as MapIcon,
	Palette,
	Play,
	RefreshCw,
	Settings,
} from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/appStore";
import { defaultSettingsPages } from "./settings-pages";

export function SettingsSidebar() {
	const { t } = useTranslation("settings");
	const activeSettingsPageId = useAppStore((s) => s.activeSettingsPageId);
	const setActiveSettingsPageId = useAppStore((s) => s.setActiveSettingsPageId);
	const setWorkspaceMode = useAppStore((s) => s.setWorkspaceMode);

	useEffect(() => {
		// Initialize to first page if none selected
		if (!activeSettingsPageId) {
			setActiveSettingsPageId(defaultSettingsPages[0].id);
		}
	}, [activeSettingsPageId, setActiveSettingsPageId]);

	return (
		<div>
			{defaultSettingsPages.map((p) => (
				<button
					key={p.id}
					type="button"
					onClick={() => {
						setActiveSettingsPageId(p.id);
						setWorkspaceMode("settings");
					}}
					className={`w-full group flex items-center gap-2 px-3 py-1.5 cursor-pointer text-xs transition-colors text-left ${
						activeSettingsPageId === p.id
							? "bg-blue-500/20 text-blue-600"
							: "hover:bg-blue-500/20 hover:text-blue-600 text-muted-foreground"
					}`}
				>
					{(() => {
						switch (p.id) {
							case "appearance":
								return (
									<Palette
										className={`flex-none h-3.5 w-3.5 ${
											activeSettingsPageId === p.id
												? "text-blue-600"
												: "text-muted-foreground hover:text-blue-600"
										}`}
									/>
								);
							case "playback":
								return (
									<Play
										className={`flex-none h-3.5 w-3.5 ${
											activeSettingsPageId === p.id
												? "text-blue-600"
												: "text-muted-foreground hover:text-blue-600"
										}`}
									/>
								);
							case "updates":
								return (
									<RefreshCw
										className={`flex-none h-3.5 w-3.5 ${
											activeSettingsPageId === p.id
												? "text-blue-600"
												: "text-muted-foreground hover:text-blue-600"
										}`}
									/>
								);
							case "roadmap":
								return (
									<MapIcon
										className={`flex-none h-3.5 w-3.5 ${
											activeSettingsPageId === p.id
												? "text-blue-600"
												: "text-muted-foreground hover:text-blue-600"
										}`}
									/>
								);
							case "about":
								return (
									<Info
										className={`flex-none h-3.5 w-3.5 ${
											activeSettingsPageId === p.id
												? "text-blue-600"
												: "text-muted-foreground hover:text-blue-600"
										}`}
									/>
								);
							default:
								return (
									<Settings
										className={`flex-none h-3.5 w-3.5 ${
											activeSettingsPageId === p.id
												? "text-blue-600"
												: "text-muted-foreground hover:text-blue-600"
										}`}
									/>
								);
						}
					})()}
					<div className="flex-auto min-w-0 h-6 leading-none flex items-center truncate">
						{t(p.id)}
					</div>
				</button>
			))}
		</div>
	);
}
