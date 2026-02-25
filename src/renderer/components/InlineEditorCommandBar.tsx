import { Braces, ListPlus, WrapText } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ATDOC_KEY_DEFINITIONS } from "../data/atdoc-keys";
import {
	ATDOC_INLINE_KEY_COMMAND_PREFIX,
	type EditorCommandId,
} from "../lib/command-palette";
import { Input } from "./ui/input";

interface InlineEditorCommandBarProps {
	open: boolean;
	top: number;
	left: number;
	onClose: () => void;
	onRunCommand: (id: EditorCommandId) => void;
}

interface EditorCommand {
	id: EditorCommandId;
	label: string;
	description: string;
	keywords: string[];
	icon: "wrap" | "line" | "preset" | "key";
}

const BASE_COMMANDS: EditorCommand[] = [
	{
		id: "insert-atdoc-block",
		label: "Insert ATDOC Block",
		description: "Insert /** */ wrapper",
		keywords: ["atdoc", "block", "wrapper"],
		icon: "wrap",
	},
	{
		id: "insert-atdoc-directive",
		label: "Insert ATDOC Directive",
		description: "Insert * at.meta.status=released",
		keywords: ["atdoc", "line", "directive", "meta"],
		icon: "line",
	},
	{
		id: "insert-atdoc-meta-preset",
		label: "Insert ATDOC Meta Preset",
		description: "Insert title/tag/status(done)/alias preset",
		keywords: ["atdoc", "preset", "meta", "title", "alias"],
		icon: "preset",
	},
];

function Icon({ type }: { type: EditorCommand["icon"] }) {
	if (type === "wrap")
		return <WrapText className="h-4 w-4 text-muted-foreground" />;
	if (type === "line")
		return <ListPlus className="h-4 w-4 text-muted-foreground" />;
	if (type === "key")
		return <ListPlus className="h-4 w-4 text-muted-foreground" />;
	return <Braces className="h-4 w-4 text-muted-foreground" />;
}

export default function InlineEditorCommandBar({
	open,
	top,
	left,
	onClose,
	onRunCommand,
}: InlineEditorCommandBarProps) {
	const rootRef = useRef<HTMLDivElement | null>(null);
	const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
	const [query, setQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);

	const allCommands = useMemo<EditorCommand[]>(() => {
		const atdocKeyCommands: EditorCommand[] = ATDOC_KEY_DEFINITIONS.map(
			(def) => ({
				id: `${ATDOC_INLINE_KEY_COMMAND_PREFIX}${def.key}` as EditorCommandId,
				label: `Insert ${def.key}`,
				description: `${def.description} · Example: ${def.example}`,
				keywords: [
					"atdoc",
					"key",
					def.key,
					...def.key.split("."),
					def.valueType,
				],
				icon: "key",
			}),
		);
		return [...BASE_COMMANDS, ...atdocKeyCommands];
	}, []);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return allCommands;
		return allCommands.filter((command) => {
			return (
				command.label.toLowerCase().includes(q) ||
				command.description.toLowerCase().includes(q) ||
				command.keywords.some((keyword) => keyword.includes(q))
			);
		});
	}, [allCommands, query]);

	useEffect(() => {
		setSelectedIndex((prev) =>
			Math.min(prev, Math.max(filtered.length - 1, 0)),
		);
	}, [filtered.length]);

	useEffect(() => {
		if (!open) return;
		const active = optionRefs.current[selectedIndex];
		if (!active) return;
		active.scrollIntoView({ block: "nearest" });
	}, [open, selectedIndex]);

	useEffect(() => {
		if (!open) return;
		setQuery("");
		setSelectedIndex(0);
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const onWindowPointerDown = (event: PointerEvent) => {
			const root = rootRef.current;
			if (!root) return;
			const target = event.target;
			if (target instanceof Node && !root.contains(target)) {
				onClose();
			}
		};

		window.addEventListener("pointerdown", onWindowPointerDown);
		return () => window.removeEventListener("pointerdown", onWindowPointerDown);
	}, [open, onClose]);

	if (!open) return null;

	return (
		<div
			ref={rootRef}
			className="absolute z-[2100] w-[420px] max-w-[calc(100%-16px)] rounded-md border border-border bg-popover text-popover-foreground shadow-xl"
			style={{ top, left }}
		>
			<div className="border-b border-border p-2">
				<Input
					autoFocus
					placeholder="Type editor command..."
					value={query}
					onChange={(event) => {
						setQuery(event.target.value);
						setSelectedIndex(0);
					}}
					onKeyDown={(event) => {
						if (event.key === "ArrowDown") {
							event.preventDefault();
							setSelectedIndex((prev) =>
								Math.min(prev + 1, Math.max(filtered.length - 1, 0)),
							);
							return;
						}
						if (event.key === "ArrowUp") {
							event.preventDefault();
							setSelectedIndex((prev) => Math.max(prev - 1, 0));
							return;
						}
						if (event.key === "Escape") {
							event.preventDefault();
							onClose();
							return;
						}
						if (event.key === "Enter") {
							event.preventDefault();
							const picked = filtered[selectedIndex];
							if (!picked) return;
							onRunCommand(picked.id);
							onClose();
						}
					}}
				/>
			</div>
			<div className="max-h-[260px] overflow-auto p-1">
				{filtered.length === 0 ? (
					<div className="px-3 py-6 text-center text-xs text-muted-foreground">
						No commands found.
					</div>
				) : (
					<div className="space-y-1">
						{filtered.map((command, index) => (
							<button
								type="button"
								key={command.id}
								ref={(node) => {
									optionRefs.current[index] = node;
								}}
								onMouseEnter={() => setSelectedIndex(index)}
								onClick={() => {
									onRunCommand(command.id);
									onClose();
								}}
								className={`w-full rounded px-2 py-1.5 text-left transition-colors ${
									selectedIndex === index
										? "bg-accent text-accent-foreground"
										: "hover:bg-accent/60"
								}`}
							>
								<div className="flex items-center gap-2">
									<Icon type={command.icon} />
									<span className="text-xs font-medium">{command.label}</span>
								</div>
								<div className="mt-0.5 text-[11px] text-muted-foreground">
									{command.description}
								</div>
							</button>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
