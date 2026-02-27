import {
	Command,
	FileSearch,
	Layout,
	ListTree,
	Music,
	Play,
	Printer,
	Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CommandIcon, GlobalCommandId } from "../lib/command-registry";
import { getCommandsWithAvailability } from "../lib/ui-command-registry";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";

interface GlobalCommandPaletteProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onRunCommand: (id: GlobalCommandId) => void;
}

function Icon({ type }: { type: CommandIcon }) {
	if (type === "file")
		return <FileSearch className="h-4 w-4 text-muted-foreground" />;
	if (type === "tree")
		return <ListTree className="h-4 w-4 text-muted-foreground" />;
	if (type === "sparkles")
		return <Sparkles className="h-4 w-4 text-muted-foreground" />;
	if (type === "layout")
		return <Layout className="h-4 w-4 text-muted-foreground" />;
	if (type === "playback")
		return <Play className="h-4 w-4 text-muted-foreground" />;
	if (type === "printer")
		return <Printer className="h-4 w-4 text-muted-foreground" />;
	if (type === "music")
		return <Music className="h-4 w-4 text-muted-foreground" />;
	return <Command className="h-4 w-4 text-muted-foreground" />;
}

export default function GlobalCommandPalette({
	open,
	onOpenChange,
	onRunCommand,
}: GlobalCommandPaletteProps) {
	const commands = getCommandsWithAvailability();
	const [query, setQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return commands;
		return commands.filter((command) => {
			return (
				command.label.toLowerCase().includes(q) ||
				command.description.toLowerCase().includes(q) ||
				command.keywords.some((keyword) => keyword.includes(q))
			);
		});
	}, [commands, query]);

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
								if (!picked.availability.enabled) return;
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
										if (!command.availability.enabled) return;
										onRunCommand(command.id);
										onOpenChange(false);
									}}
									disabled={!command.availability.enabled}
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
										{!command.availability.enabled &&
										command.availability.reason
											? ` · ${command.availability.reason}`
											: ""}
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
