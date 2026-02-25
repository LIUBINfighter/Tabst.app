import { Command, FileSearch, ListTree, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";

export type GlobalCommandId =
	| "open-quick-file"
	| "open-editor-command-palette"
	| "insert-atdoc-block"
	| "insert-atdoc-directive"
	| "insert-atdoc-meta-preset";

interface GlobalCommandPaletteProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onRunCommand: (id: GlobalCommandId) => void;
}

interface PaletteCommand {
	id: GlobalCommandId;
	label: string;
	description: string;
	keywords: string[];
	icon: "command" | "file" | "tree" | "sparkles";
}

const COMMANDS: PaletteCommand[] = [
	{
		id: "open-quick-file",
		label: "Quick Open Files",
		description: "Open .atex files by name/tag",
		keywords: ["file", "open", "quick", "search", "tag"],
		icon: "file",
	},
	{
		id: "open-editor-command-palette",
		label: "Editor Command Palette",
		description: "Open line-level command palette",
		keywords: ["editor", "inline", "line", "command"],
		icon: "command",
	},
	{
		id: "insert-atdoc-block",
		label: "Insert ATDOC Block",
		description: "Insert /** */ wrapper template",
		keywords: ["atdoc", "comment", "block", "wrapper"],
		icon: "tree",
	},
	{
		id: "insert-atdoc-directive",
		label: "Insert ATDOC Directive",
		description: "Insert * at.meta.status=active",
		keywords: ["atdoc", "directive", "meta", "status"],
		icon: "sparkles",
	},
	{
		id: "insert-atdoc-meta-preset",
		label: "Insert ATDOC Meta Preset",
		description: "Insert title/tag/status preset lines",
		keywords: ["atdoc", "meta", "preset", "alias", "title"],
		icon: "sparkles",
	},
];

function Icon({ type }: { type: PaletteCommand["icon"] }) {
	if (type === "file")
		return <FileSearch className="h-4 w-4 text-muted-foreground" />;
	if (type === "tree")
		return <ListTree className="h-4 w-4 text-muted-foreground" />;
	if (type === "sparkles")
		return <Sparkles className="h-4 w-4 text-muted-foreground" />;
	return <Command className="h-4 w-4 text-muted-foreground" />;
}

export default function GlobalCommandPalette({
	open,
	onOpenChange,
	onRunCommand,
}: GlobalCommandPaletteProps) {
	const [query, setQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return COMMANDS;
		return COMMANDS.filter((command) => {
			return (
				command.label.toLowerCase().includes(q) ||
				command.description.toLowerCase().includes(q) ||
				command.keywords.some((keyword) => keyword.includes(q))
			);
		});
	}, [query]);

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

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				onOpenChange(nextOpen);
				if (!nextOpen) {
					setQuery("");
					setSelectedIndex(0);
				}
			}}
		>
			<DialogContent className="sm:max-w-xl p-0 gap-0">
				<DialogTitle className="sr-only">Global Command Palette</DialogTitle>
				<div className="border-b border-border p-3">
					<Input
						autoFocus
						placeholder="Type a command..."
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
							if (event.key === "Enter") {
								event.preventDefault();
								const picked = filtered[selectedIndex];
								if (!picked) return;
								onRunCommand(picked.id);
								onOpenChange(false);
							}
						}}
					/>
				</div>
				<div className="max-h-[55vh] overflow-auto p-2">
					{filtered.length === 0 ? (
						<div className="px-3 py-8 text-center text-sm text-muted-foreground">
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
										onOpenChange(false);
									}}
									className={`w-full rounded-md px-3 py-2 text-left transition-colors ${
										selectedIndex === index
											? "bg-accent text-accent-foreground"
											: "hover:bg-accent/60"
									}`}
								>
									<div className="flex items-center gap-2">
										<Icon type={command.icon} />
										<span className="text-sm font-medium">{command.label}</span>
									</div>
									<div className="mt-1 text-xs text-muted-foreground">
										{command.description}
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
