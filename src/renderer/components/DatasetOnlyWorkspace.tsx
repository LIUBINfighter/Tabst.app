import { useAppStore } from "../store/appStore";

export function DatasetOnlyWorkspace() {
	const datasetActive = useAppStore((s) => s.datasetActive);

	if (!datasetActive) return null;

	return (
		<div className="rounded border border-border/60 bg-card p-4 space-y-2">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h3 className="text-sm font-medium text-foreground">
						{datasetActive.name}
					</h3>
					<p className="text-[11px] text-muted-foreground break-all mt-1">
						{datasetActive.id}
					</p>
				</div>
			</div>

			<div className="text-xs text-muted-foreground">
				No sample selected. Select a sample in the sidebar to edit source,
				subsamples, and review metadata.
			</div>
		</div>
	);
}
