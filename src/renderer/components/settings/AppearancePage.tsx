import { CheckCircle2, FolderOpen, Loader2, XCircle } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type Locale, supportedLocales } from "../../i18n";
import {
	BUILT_IN_FONT_OPTIONS,
	BUILT_IN_SOUNDFONT_OPTIONS,
	getBuiltInFontByUrl,
	getBuiltInSoundFontByUrl,
} from "../../lib/resource-asset-catalog";
import { useAppStore } from "../../store/appStore";
import { ThemeSelector } from "../theme";
import { TutorialAlphaTexPlayground } from "../tutorial/TutorialAlphaTexPlayground";
import { Button } from "../ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";

const APPEARANCE_PREVIEW_CONTENT = `\\title "Theme and Playback Preview"
\\subtitle "Built-in Font + Soundfont"
\\tempo 95
\\track "Guitar"
  \\instrument acousticguitarsteel
  \\tuning E4 B3 G3 D3 A2 E2
  0.6 2.5 2.4 0.4 | 3.5 2.5 0.5 2.4 |
  (0.4 2.4 2.3) 0.4 | 3.5 2.5 0.5 2.4
`;

function formatSize(bytes: number): string {
	if (bytes <= 0) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	const index = Math.min(
		Math.floor(Math.log(bytes) / Math.log(1024)),
		units.length - 1,
	);
	const value = bytes / 1024 ** index;
	return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[index]}`;
}

export function AppearancePage() {
	const { t } = useTranslation("settings");
	const locale = useAppStore((s) => s.locale);
	const setLocale = useAppStore((s) => s.setLocale);
	const resourceAssetOverrides = useAppStore((s) => s.resourceAssetOverrides);
	const setResourceAssetOverrides = useAppStore(
		(s) => s.setResourceAssetOverrides,
	);
	const externalSoundFont = useAppStore((s) => s.externalSoundFont);
	const setExternalSoundFont = useAppStore((s) => s.setExternalSoundFont);
	const clearExternalSoundFont = useAppStore((s) => s.clearExternalSoundFont);
	const playerControls = useAppStore((s) => s.playerControls);

	const [soundFontBusy, setSoundFontBusy] = useState<
		"choose" | "test" | "clear" | "reveal" | null
	>(null);
	const [soundFontError, setSoundFontError] = useState<string | null>(null);
	const [soundFontNotice, setSoundFontNotice] = useState<string | null>(null);

	const selectedFontId =
		getBuiltInFontByUrl(resourceAssetOverrides.bravuraFontUrl)?.id ??
		BUILT_IN_FONT_OPTIONS[0].id;
	const selectedSoundFontId =
		getBuiltInSoundFontByUrl(resourceAssetOverrides.soundFontUrl)?.id ??
		BUILT_IN_SOUNDFONT_OPTIONS[0].id;

	const soundFontErrorMessage = (error?: string): string => {
		if (!error) return t("externalSoundFontErrors.unknown");
		const key = `externalSoundFontErrors.${error}`;
		const translated = t(key);
		return translated === key ? error : translated;
	};

	const handleChooseLocalSoundFont = async () => {
		setSoundFontBusy("choose");
		setSoundFontError(null);
		setSoundFontNotice(null);
		try {
			const selection = await window.desktopAPI.selectSoundFontFile();
			if (!selection) return;
			if (!selection.valid) {
				setSoundFontError(soundFontErrorMessage(selection.error));
				return;
			}
			const saved = await window.desktopAPI.saveExternalSoundFontPath(
				selection.path,
			);
			if (!saved.success || !saved.valid) {
				setSoundFontError(soundFontErrorMessage(saved.error));
				return;
			}
			setExternalSoundFont(saved);
			playerControls?.refresh?.();
		} finally {
			setSoundFontBusy(null);
		}
	};

	const handleTestExternalSoundFont = async () => {
		if (!externalSoundFont?.path) return;
		setSoundFontBusy("test");
		setSoundFontError(null);
		setSoundFontNotice(null);
		try {
			const result = await window.desktopAPI.saveExternalSoundFontPath(
				externalSoundFont.path,
			);
			if (!result.success || !result.valid) {
				setSoundFontError(soundFontErrorMessage(result.error));
				return;
			}
			setExternalSoundFont(result);
			playerControls?.refresh?.();
		} finally {
			setSoundFontBusy(null);
		}
	};

	const handleRevealExternalSoundFont = async () => {
		if (!externalSoundFont?.path) return;
		setSoundFontBusy("reveal");
		setSoundFontError(null);
		try {
			await window.desktopAPI.revealInFolder(externalSoundFont.path);
		} finally {
			setSoundFontBusy(null);
		}
	};

	const handleClearExternalSoundFont = async () => {
		setSoundFontBusy("clear");
		setSoundFontError(null);
		setSoundFontNotice(null);
		try {
			await clearExternalSoundFont();
			setSoundFontNotice(t("externalSoundFontCleared"));
			playerControls?.refresh?.();
		} finally {
			setSoundFontBusy(null);
		}
	};

	const externalActive = Boolean(externalSoundFont?.valid);

	return (
		<div className="space-y-6">
			<section className="bg-card border border-border rounded p-4 space-y-4">
				<div>
					<h3 className="text-sm font-medium mb-2">
						{t("appearanceSection.language")}
					</h3>
					<p className="text-xs text-muted-foreground mb-2">
						{t("appearanceSection.languageHint")}
					</p>
					<Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
						<SelectTrigger className="w-48">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{supportedLocales.map((l) => (
								<SelectItem key={l} value={l}>
									{l === "en"
										? t("appearanceSection.languageEn")
										: t("appearanceSection.languageZh")}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</section>

			<section className="bg-card border border-border rounded p-4 space-y-4">
				<div>
					<h3 className="text-sm font-medium mb-4">
						{t("appearanceSection.theme")}
					</h3>
					<ThemeSelector />
					<TutorialAlphaTexPlayground
						initialContent={APPEARANCE_PREVIEW_CONTENT}
						fileName="appearance-preview.atex"
					/>
				</div>
			</section>

			<section className="bg-card border border-border rounded p-4 space-y-4">
				<div>
					<h3 className="text-sm font-medium mb-2">
						{t("appearanceSection.resourceAssets")}
					</h3>
					<p className="text-xs text-muted-foreground mb-3">
						{t("appearanceSection.resourceAssetsHint")}
					</p>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						<div>
							<p className="text-xs text-muted-foreground mb-1.5">
								{t("appearanceSection.builtInFont")}
							</p>
							<Select
								value={selectedFontId}
								onValueChange={(nextId) => {
									const selected = BUILT_IN_FONT_OPTIONS.find(
										(option) => option.id === nextId,
									);
									if (!selected) return;
									setResourceAssetOverrides({
										bravuraFontUrl: selected.relativeUrl,
									});
									playerControls?.refresh?.();
								}}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{BUILT_IN_FONT_OPTIONS.map((option) => (
										<SelectItem key={option.id} value={option.id}>
											{`${option.label} (${option.sizeLabel})`}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div>
							<p className="text-xs text-muted-foreground mb-1.5">
								{t("appearanceSection.builtInSoundFont")}
							</p>
							<Select
								value={selectedSoundFontId}
								onValueChange={(nextId) => {
									const selected = BUILT_IN_SOUNDFONT_OPTIONS.find(
										(option) => option.id === nextId,
									);
									if (!selected) return;
									setResourceAssetOverrides({
										soundFontUrl: selected.relativeUrl,
									});
									playerControls?.refresh?.();
								}}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{BUILT_IN_SOUNDFONT_OPTIONS.map((option) => (
										<SelectItem key={option.id} value={option.id}>
											{`${option.label} (${option.sizeLabel})`}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="mt-4 border-t pt-4 space-y-3">
						<div className="flex flex-wrap items-center gap-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => void handleChooseLocalSoundFont()}
								disabled={soundFontBusy !== null}
							>
								{soundFontBusy === "choose" && (
									<Loader2 className="animate-spin" />
								)}
								{t("appearanceSection.chooseLocalSoundFont")}
							</Button>
							{externalSoundFont?.configured && (
								<span
									className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
										externalActive
											? "border-emerald-500/40 text-emerald-600"
											: "border-amber-500/40 text-amber-600"
									}`}
								>
									{externalActive ? (
										<CheckCircle2 className="h-3 w-3" />
									) : (
										<XCircle className="h-3 w-3" />
									)}
									{t(
										externalActive
											? "appearanceSection.externalSoundFontActive"
											: "appearanceSection.externalSoundFontUnavailable",
									)}
								</span>
							)}
						</div>

						{externalSoundFont?.configured && (
							<div className="rounded border border-border p-3 space-y-2 text-xs">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<span className="font-medium text-sm">
										{t("appearanceSection.externalSoundFontTitle")}:{" "}
										{externalSoundFont.name ?? externalSoundFont.path}
									</span>
								</div>
								{externalSoundFont.path && (
									<p
										className="text-muted-foreground break-all"
										title={externalSoundFont.path}
									>
										{externalSoundFont.path}
									</p>
								)}
								{externalSoundFont.size !== undefined && (
									<p className="text-muted-foreground">
										{t("appearanceSection.externalSoundFontSizeFormat", {
											size: formatSize(externalSoundFont.size),
											format: externalSoundFont.format ?? "",
										})}
									</p>
								)}
								{externalSoundFont.error && (
									<p className="text-destructive">
										{soundFontErrorMessage(externalSoundFont.error)}
									</p>
								)}
								<div className="flex flex-wrap gap-2 pt-1">
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => void handleTestExternalSoundFont()}
										disabled={soundFontBusy !== null}
									>
										{soundFontBusy === "test" && (
											<Loader2 className="animate-spin" />
										)}
										{t("appearanceSection.externalSoundFontTest")}
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => void handleChooseLocalSoundFont()}
										disabled={soundFontBusy !== null}
									>
										{t("appearanceSection.externalSoundFontReplace")}
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => void handleRevealExternalSoundFont()}
										disabled={soundFontBusy !== null || !externalSoundFont.path}
									>
										{soundFontBusy === "reveal" ? (
											<Loader2 className="animate-spin" />
										) : (
											<FolderOpen />
										)}
										{t("appearanceSection.externalSoundFontReveal")}
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => void handleClearExternalSoundFont()}
										disabled={soundFontBusy !== null}
									>
										{soundFontBusy === "clear" && (
											<Loader2 className="animate-spin" />
										)}
										{t("appearanceSection.externalSoundFontClear")}
									</Button>
								</div>
							</div>
						)}

						{soundFontError && (
							<p className="text-xs text-destructive">{soundFontError}</p>
						)}
						{soundFontNotice && (
							<p className="text-xs text-emerald-600">{soundFontNotice}</p>
						)}
					</div>
				</div>
			</section>
		</div>
	);
}
