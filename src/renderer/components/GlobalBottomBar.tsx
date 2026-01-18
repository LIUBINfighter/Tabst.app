import { useAppStore } from "../store/appStore";
import StaffControls from "./StaffControls";

export default function GlobalBottomBar() {
	const activeFile = useAppStore((state) => state.getActiveFile());
	const firstStaffOptions = useAppStore((state) => state.firstStaffOptions);
	const requestStaffToggle = useAppStore((state) => state.requestStaffToggle);
	const isAtexFile = activeFile?.path.endsWith(".atex") ?? false;

	return (
		<footer className="fixed bottom-0 left-0 right-0 z-40 h-9 border-t border-border bg-card flex items-center justify-between px-4 text-xs text-muted-foreground">
			{/* Left: app status */}
			<div className="flex items-center gap-3">
				<span className="font-medium">Tabst</span>
			</div>

			{/* Right: staff controls (only for .atex files) */}
			{isAtexFile && (
				<StaffControls
					firstStaffOptions={firstStaffOptions}
					toggleFirstStaffOpt={requestStaffToggle}
				/>
			)}
		</footer>
	);
}
