import { Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { runUiCommand } from "../../lib/ui-command-registry";
import { useAppStore } from "../../store/appStore";
import { Button } from "../ui/button";
import { CheckboxToggle } from "../ui/checkbox-toggle";

function normalizePath(path: string): string {
	return path.replace(/\\/g, "/");
}

function isTemplateCandidate(name: string): boolean {
	const lower = name.toLowerCase();
	return lower.endsWith(".atex") || lower.endsWith(".md");
}

export function TemplatesPage() {
	const { t } = useTranslation("settings");
	const files = useAppStore((s) => s.files);
	const activeFileId = useAppStore((s) => s.activeFileId);
	const templateFilePaths = useAppStore((s) => s.templateFilePaths);
	const setFileTemplate = useAppStore((s) => s.setFileTemplate);

	const templatePathSet = useMemo(
		() => new Set(templateFilePaths.map((path) => normalizePath(path))),
		[templateFilePaths],
	);

	const activeFile = useMemo(
		() => files.find((file) => file.id === activeFileId) ?? null,
		[files, activeFileId],
	);

	const candidateFiles = useMemo(
		() => files.filter((file) => isTemplateCandidate(file.name)),
		[files],
	);

	const markedTemplates = useMemo(
		() =>
			candidateFiles.filter((file) =>
				templatePathSet.has(normalizePath(file.path)),
			),
		[candidateFiles, templatePathSet],
	);

	return (
		<div className="space-y-6">
			<section className="bg-card border border-border rounded p-4 space-y-2">
				<h3 className="text-sm font-medium">{t("templates")}</h3>
				<p className="text-xs text-muted-foreground">{t("templatesDesc")}</p>
				<div className="flex flex-wrap gap-2 pt-1">
					<Button
						variant="outline"
						size="sm"
						onClick={() => runUiCommand("template.insert.open-picker")}
					>
						{t("templatesOpenInsertCommand")}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => runUiCommand("template.new-from.open-picker")}
					>
						{t("templatesOpenCreateCommand")}
					</Button>
				</div>
			</section>

			<section className="bg-card border border-border rounded p-4 space-y-2">
				<h3 className="text-sm font-medium">{t("templatesActiveFile")}</h3>
				{activeFile ? (
					<div className="flex items-start gap-3">
						<CheckboxToggle
							checked={templatePathSet.has(normalizePath(activeFile.path))}
							onCheckedChange={(checked) =>
								setFileTemplate(activeFile.path, checked)
							}
							aria-label={activeFile.name}
						/>
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2 text-sm font-medium">
								<Sparkles className="h-4 w-4 text-muted-foreground" />
								<span className="truncate">{activeFile.name}</span>
							</div>
							<p className="mt-1 text-xs text-muted-foreground truncate font-mono">
								{activeFile.path}
							</p>
						</div>
					</div>
				) : (
					<p className="text-xs text-muted-foreground">
						{t("templatesNoActiveFile")}
					</p>
				)}
			</section>

			<section className="bg-card border border-border rounded p-4 space-y-3">
				<h3 className="text-sm font-medium">{t("templatesMarked")}</h3>
				{markedTemplates.length === 0 ? (
					<p className="text-xs text-muted-foreground">{t("templatesNone")}</p>
				) : (
					<div className="space-y-2">
						{markedTemplates.map((file) => (
							<div
								key={file.path}
								className="flex items-start gap-3 rounded border border-border px-3 py-2"
							>
								<CheckboxToggle
									checked
									onCheckedChange={(checked) =>
										setFileTemplate(file.path, checked)
									}
									aria-label={file.name}
								/>
								<div className="min-w-0 flex-1">
									<div className="text-sm font-medium truncate">
										{file.name}
									</div>
									<p className="mt-1 text-xs text-muted-foreground truncate font-mono">
										{file.path}
									</p>
								</div>
							</div>
						))}
					</div>
				)}
			</section>

			<section className="bg-card border border-border rounded p-4 space-y-3">
				<h3 className="text-sm font-medium">{t("templatesAllFiles")}</h3>
				<p className="text-xs text-muted-foreground">
					{t("templatesAllFilesHint")}
				</p>
				<div className="space-y-2">
					{candidateFiles.map((file) => {
						const checked = templatePathSet.has(normalizePath(file.path));
						return (
							<div
								key={`candidate-${file.path}`}
								className="flex items-start gap-3 rounded border border-border px-3 py-2"
							>
								<CheckboxToggle
									checked={checked}
									onCheckedChange={(nextChecked) =>
										setFileTemplate(file.path, nextChecked)
									}
									aria-label={file.name}
								/>
								<div className="min-w-0 flex-1">
									<div className="text-sm font-medium truncate">
										{file.name}
									</div>
									<p className="mt-1 text-xs text-muted-foreground truncate font-mono">
										{file.path}
									</p>
								</div>
							</div>
						);
					})}
				</div>
			</section>
		</div>
	);
}
