import { FileText, PlusSquare } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";

export interface TemplatePickerItem {
	path: string;
	name: string;
	title?: string;
}

interface TemplatePickerDialogProps {
	open: boolean;
	mode: "insert" | "create";
	templates: TemplatePickerItem[];
	onOpenChange: (open: boolean) => void;
	onSelect: (path: string) => void;
}

export function TemplatePickerDialog({
	open,
	mode,
	templates,
	onOpenChange,
	onSelect,
}: TemplatePickerDialogProps) {
	const { t } = useTranslation("settings");
	const [query, setQuery] = useState("");

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return templates;

		return templates.filter((item) => {
			return (
				item.name.toLowerCase().includes(q) ||
				item.path.toLowerCase().includes(q) ||
				item.title?.toLowerCase().includes(q)
			);
		});
	}, [query, templates]);

	const title =
		mode === "insert"
			? t("templatesPickerInsertTitle")
			: t("templatesPickerCreateTitle");

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				onOpenChange(nextOpen);
				if (!nextOpen) {
					setQuery("");
				}
			}}
		>
			<DialogContent className="sm:max-w-xl p-0 gap-0">
				<DialogHeader className="px-4 pt-4 pb-2 border-b border-border">
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>
				<div className="px-4 py-3 border-b border-border">
					<Input
						autoFocus
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={t("templatesPickerSearchPlaceholder")}
					/>
				</div>
				<div className="max-h-[55vh] overflow-auto p-2">
					{filtered.length === 0 ? (
						<div className="px-3 py-8 text-center text-sm text-muted-foreground">
							{t("templatesPickerEmpty")}
						</div>
					) : (
						<div className="space-y-1">
							{filtered.map((item) => (
								<button
									type="button"
									key={item.path}
									onClick={() => {
										onSelect(item.path);
										onOpenChange(false);
									}}
									className="w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-accent/60"
								>
									<div className="flex items-center gap-2 text-sm font-medium">
										{mode === "insert" ? (
											<FileText className="h-4 w-4 text-muted-foreground" />
										) : (
											<PlusSquare className="h-4 w-4 text-muted-foreground" />
										)}
										<span>{item.name}</span>
									</div>
									<div className="mt-1 text-xs text-muted-foreground">
										{item.title ? `${item.title} · ${item.path}` : item.path}
									</div>
								</button>
							))}
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
