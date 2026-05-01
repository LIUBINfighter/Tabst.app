import type { Extension } from "@codemirror/state";
import { EditorState } from "@codemirror/state";
import { basicSetup, EditorView } from "codemirror";
import { useEffect, useMemo, useRef } from "react";
import { useEditorTheme } from "@/renderer/hooks/useEditorTheme";
import { getAlphaTexHighlight } from "@/renderer/lib/alphatex-highlight";
import { whitespaceDecoration } from "@/renderer/lib/whitespace-decoration";

interface TutorialPlaygroundEditorProps {
	initialContent: string;
	fileName?: string;
	className?: string;
	onChange?: (content: string) => void;
}

export function TutorialPlaygroundEditor({
	initialContent,
	className,
	onChange,
}: TutorialPlaygroundEditorProps) {
	const hostRef = useRef<HTMLDivElement | null>(null);
	const viewRef = useRef<EditorView | null>(null);
	const initialContentRef = useRef(initialContent);
	const lastDocRef = useRef<string>(initialContent);
	const onChangeRef = useRef(onChange);
	const { themeExtension } = useEditorTheme();

	useEffect(() => {
		initialContentRef.current = initialContent;
	}, [initialContent]);

	useEffect(() => {
		onChangeRef.current = onChange;
	}, [onChange]);

	const baseExtensions = useMemo<Extension[]>(
		() => [basicSetup, whitespaceDecoration(), themeExtension],
		[themeExtension],
	);

	useEffect(() => {
		let canceled = false;

		const setup = async () => {
			if (!hostRef.current) return;

			const alphaTexHighlight = await getAlphaTexHighlight();
			if (canceled || !hostRef.current) return;

			const extensions: Extension[] = [
				...baseExtensions,
				EditorView.lineWrapping,
				...alphaTexHighlight,
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						const doc = update.state.doc.toString();
						lastDocRef.current = doc;
						onChangeRef.current?.(doc);
					}
				}),
			];
			const initialDoc = initialContentRef.current;
			lastDocRef.current = initialDoc;

			const state = EditorState.create({
				doc: initialDoc,
				extensions,
			});

			viewRef.current = new EditorView({
				state,
				parent: hostRef.current,
			});
		};

		setup();

		return () => {
			canceled = true;
			if (viewRef.current) {
				viewRef.current.destroy();
				viewRef.current = null;
			}
			if (hostRef.current) {
				hostRef.current.innerHTML = "";
			}
		};
	}, [baseExtensions]);

	useEffect(() => {
		const view = viewRef.current;
		if (!view) return;
		if (lastDocRef.current === initialContent) return;

		view.dispatch({
			changes: {
				from: 0,
				to: view.state.doc.length,
				insert: initialContent,
			},
		});
		lastDocRef.current = initialContent;
	}, [initialContent]);

	return (
		<div
			ref={hostRef}
			className={`h-full w-full bg-card text-foreground font-mono text-sm leading-6 ${className ?? ""}`}
		/>
	);
}

export default TutorialPlaygroundEditor;
