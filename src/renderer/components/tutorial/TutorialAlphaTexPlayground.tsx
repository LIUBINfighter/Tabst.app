import { useEffect, useMemo, useRef } from "react";
import { type FileItem, useAppStore } from "../../store/appStore";
import Editor from "../Editor";
import Preview from "../Preview";

interface TutorialAlphaTexPlaygroundProps {
	initialContent: string;
	fileName?: string;
}

export function TutorialAlphaTexPlayground({
	initialContent,
	fileName = "tutorial.atex",
}: TutorialAlphaTexPlaygroundProps) {
	const tempFileIdRef = useRef(
		`tutorial-playground-${Math.random().toString(36).slice(2)}`,
	);
	const tempFileId = tempFileIdRef.current;

	const tempFile = useMemo<FileItem>(
		() => ({
			id: tempFileId,
			name: fileName,
			path: `/tutorials/${fileName}`,
			content: initialContent,
			contentLoaded: true,
		}),
		[fileName, initialContent, tempFileId],
	);

	const prevStateRef = useRef<{
		files: FileItem[];
		activeFileId: string | null;
	} | null>(null);

	useEffect(() => {
		const current = useAppStore.getState();
		if (!prevStateRef.current) {
			prevStateRef.current = {
				files: current.files,
				activeFileId: current.activeFileId,
			};
		}

		useAppStore.setState((state) => {
			const exists = state.files.some((f) => f.id === tempFileId);
			const files = exists
				? state.files.map((f) => (f.id === tempFileId ? tempFile : f))
				: [...state.files, tempFile];

			return {
				files,
				activeFileId: tempFileId,
			};
		});

		return () => {
			const prev = prevStateRef.current;
			if (!prev) return;
			useAppStore.setState({
				files: prev.files,
				activeFileId: prev.activeFileId,
			});
			prevStateRef.current = null;
		};
	}, [tempFile, tempFileId]);

	return (
		<div className="not-prose my-4 rounded-lg border border-border overflow-hidden bg-card h-[620px]">
			<div className="px-3 py-2 border-b border-border text-xs text-muted-foreground">
				Interactive AlphaTex Playground
			</div>
			<div className="grid grid-cols-2 h-[580px]">
				<div className="border-r border-border overflow-hidden">
					<Editor hidePreview sandboxMode />
				</div>
				<div className="overflow-hidden">
					<Preview
						fileName={fileName}
						content={initialContent}
						className="h-full"
					/>
				</div>
			</div>
		</div>
	);
}
