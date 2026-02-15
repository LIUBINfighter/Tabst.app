import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { loadGlobalSettings, saveGlobalSettings } from "../lib/global-settings";
import type { DeleteBehavior } from "../types/repo";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./ui/dialog";

export interface DeleteConfirmDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: (behavior: DeleteBehavior) => void;
	fileName: string;
}

export function DeleteConfirmDialog({
	isOpen,
	onClose,
	onConfirm,
	fileName,
}: DeleteConfirmDialogProps) {
	const { t } = useTranslation("sidebar");
	const [_selectedBehavior, _setSelectedBehavior] =
		useState<DeleteBehavior>("ask-every-time");
	const [rememberChoice, setRememberChoice] = useState(false);

	useEffect(() => {
		// Load current preference to reflect existing setting
		void (async () => {
			const s = await loadGlobalSettings();
			if (s.deleteBehavior && s.deleteBehavior !== "ask-every-time") {
				_setSelectedBehavior(s.deleteBehavior);
			}
		})();
	}, []);

	const handleConfirm = (behavior: DeleteBehavior) => {
		onConfirm(behavior);
		if (rememberChoice && behavior !== "ask-every-time") {
			void saveGlobalSettings({ deleteBehavior: behavior });
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
					<DialogDescription>
						{t("deleteConfirmDescription", { fileName })}
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4 py-4">
					<div className="space-y-2">
						<button
							type="button"
							onClick={() => handleConfirm("system-trash")}
							className="w-full p-3 text-left border rounded hover:bg-accent transition-colors"
						>
							<div className="font-medium">{t("moveToSystemTrash")}</div>
							<div className="text-xs text-muted-foreground">
								{t("systemTrashDescription")}
							</div>
						</button>

						<button
							type="button"
							onClick={() => handleConfirm("repo-trash")}
							className="w-full p-3 text-left border rounded hover:bg-accent transition-colors"
						>
							<div className="font-medium">{t("moveToRepoTrash")}</div>
							<div className="text-xs text-muted-foreground">
								{t("repoTrashDescription")}
							</div>
						</button>
					</div>

					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							checked={rememberChoice}
							onChange={(e) => setRememberChoice(e.target.checked)}
							className="rounded border-border"
						/>
						{t("rememberMyChoice")}
					</label>
				</div>

				<DialogFooter className="gap-2">
					<button
						type="button"
						onClick={onClose}
						className="px-4 py-2 text-sm border rounded hover:bg-accent"
					>
						{t("cancel")}
					</button>
					<button
						type="button"
						onClick={() => handleConfirm("ask-every-time")}
						className="px-4 py-2 text-sm border rounded hover:bg-accent"
					>
						{t("askEveryTime")}
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
