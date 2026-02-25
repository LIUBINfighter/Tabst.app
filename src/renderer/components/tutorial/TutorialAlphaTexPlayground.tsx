import { useEffect, useMemo, useState } from "react";
import type { FileItem } from "../../store/appStore";
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
	const [content, setContent] = useState(initialContent);

	useEffect(() => {
		setContent(initialContent);
	}, [initialContent]);

	const sandboxFile = useMemo<FileItem>(
		() => ({
			id: `tutorial-playground-${fileName}`,
			name: fileName,
			path: `/tutorials/${fileName}`,
			content,
			contentLoaded: true,
		}),
		[fileName, content],
	);

	return (
		<div className="not-prose my-4 rounded-lg border border-border overflow-hidden bg-card h-[620px]">
			<div className="px-3 py-2 border-b border-border text-xs text-muted-foreground">
				Interactive AlphaTex Playground
			</div>
			<div className="grid grid-cols-2 h-[580px]">
				<div className="border-r border-border overflow-hidden">
					<Editor
						hidePreview
						sandboxMode
						sandboxFile={sandboxFile}
						onSandboxContentChange={setContent}
					/>
				</div>
				<div className="overflow-hidden">
					<Preview fileName={fileName} content={content} className="h-full" />
				</div>
			</div>
		</div>
	);
}
