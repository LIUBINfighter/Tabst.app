import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "../store/appStore";

export default function DatasetTopToast({ className }: { className?: string }) {
	const datasetFeedback = useAppStore((s) => s.datasetFeedback);
	const clearDatasetFeedback = useAppStore((s) => s.clearDatasetFeedback);

	const [visible, setVisible] = useState(false);

	const kind = datasetFeedback?.kind;
	const isSuccess = kind === "success";

	const toneClassName = useMemo(() => {
		if (isSuccess) {
			return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
		}

		return "border-destructive/40 bg-destructive/10 text-destructive";
	}, [isSuccess]);

	useEffect(() => {
		if (!datasetFeedback) {
			setVisible(false);
			return;
		}

		setVisible(true);
		const timer = window.setTimeout(() => {
			clearDatasetFeedback();
		}, 2400);

		return () => {
			window.clearTimeout(timer);
		};
	}, [datasetFeedback, clearDatasetFeedback]);

	if (!datasetFeedback || !visible) return null;

	return (
		<div
			className={`pointer-events-auto z-50 w-fit max-w-[calc(100vw-32px)] rounded border px-3 py-2 text-xs shadow text-center ${toneClassName} ${
				className ?? ""
			}`}
			role="status"
			aria-live="polite"
		>
			<div className="relative flex items-center justify-center gap-3">
				<button
					type="button"
					className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded hover:bg-black/5 dark:hover:bg-white/10"
					onClick={() => clearDatasetFeedback()}
					aria-label="Dismiss notification"
				>
					<X className="h-3.5 w-3.5" />
				</button>

				{/* Reserve space for the dismiss button to avoid text overlap. */}
				<div className="min-w-0 break-words pr-7 pl-1">
					{datasetFeedback.message}
				</div>
			</div>
		</div>
	);
}
