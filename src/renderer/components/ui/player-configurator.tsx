import { Check, GripVertical, RotateCcw } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import {
	type PlayerComponentConfig,
	type PlayerComponentType,
	useAppStore,
} from "../../store/appStore";
import { Button } from "./button";

interface PlayerConfiguratorProps {
	className?: string;
}

export function PlayerConfigurator({ className }: PlayerConfiguratorProps) {
	const { t } = useTranslation("settings");
	const {
		customPlayerConfig,
		updatePlayerComponentOrder,
		togglePlayerComponent,
		setCustomPlayerConfig,
	} = useAppStore();

	const [isDragging, setIsDragging] = React.useState(false);
	const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

	const handleDragStart = (e: React.DragEvent, index: number) => {
		e.dataTransfer.setData("text/plain", index.toString());
		e.dataTransfer.effectAllowed = "move";
		setIsDragging(true);
	};

	const handleDragOver = (e: React.DragEvent, index: number) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";

		// Calculate insert position based on mouse position
		const rect = e.currentTarget.getBoundingClientRect();
		const y = e.clientY - rect.top;
		const height = rect.height;

		// If mouse is in the top half, insert before this item
		// If mouse is in the bottom half, insert after this item
		const insertIndex = y < height / 2 ? index : index + 1;

		setDragOverIndex(insertIndex);
	};

	const handleDragLeave = () => {
		// Clear drag over index when leaving the container
		setDragOverIndex(null);
	};

	const handleDragEnd = () => {
		setIsDragging(false);
		setDragOverIndex(null);
	};

	const handleDrop = (e: React.DragEvent, dropIndex: number) => {
		e.preventDefault();
		const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);

		if (dragIndex === dropIndex) return;

		const newComponents = [...customPlayerConfig.components];
		const [draggedItem] = newComponents.splice(dragIndex, 1);
		newComponents.splice(dropIndex, 0, draggedItem);

		updatePlayerComponentOrder(newComponents);
		setIsDragging(false);
		setDragOverIndex(null);
	};

	const handleToggle = (type: PlayerComponentType) => {
		togglePlayerComponent(type);
	};

	const handleReset = () => {
		setCustomPlayerConfig({
			components: [
				{
					type: "staffControls",
					enabled: true,
					label: t("playerConfigurator.staffControls"),
					description: t("playerConfigurator.staffControlsDesc"),
				},
				{
					type: "tracksControls",
					enabled: false,
					label: t("playerConfigurator.tracksControls"),
					description: t("playerConfigurator.tracksControlsDesc"),
				},
				{
					type: "zoomControls",
					enabled: true,
					label: t("playerConfigurator.zoomControls"),
					description: t("playerConfigurator.zoomControlsDesc"),
				},
				{
					type: "playbackSpeedControls",
					enabled: true,
					label: t("playerConfigurator.playbackSpeedControls"),
					description: t("playerConfigurator.playbackSpeedControlsDesc"),
				},
				{
					type: "playbackTransport",
					enabled: true,
					label: t("playerConfigurator.playbackTransport"),
					description: t("playerConfigurator.playbackTransportDesc"),
				},
			],
		});
	};

	return (
		<div className={className}>
			<div
				className="space-y-3 relative"
				onDragLeave={handleDragLeave}
				onDragEnd={handleDragEnd}
				role="region"
				aria-label={t("playerConfigurator.dragDropArea")}
			>
				{customPlayerConfig.components.map(
					(component: PlayerComponentConfig, index: number) => (
						<React.Fragment key={component.type}>
							{/* Drop indicator line */}
							{isDragging && dragOverIndex === index && (
								<div
									className="absolute left-0 right-0 h-0.5 bg-primary rounded-full z-10 -translate-y-1.5"
									style={{ top: `${index * 72 + 12}px` }}
								/>
							)}

							<div
								draggable
								onDragStart={(e) => handleDragStart(e, index)}
								onDragOver={(e) => handleDragOver(e, index)}
								onDrop={(e) => handleDrop(e, index)}
								onClick={() => handleToggle(component.type)}
								onKeyDown={(event) => {
									if (event.key === " " || event.key === "Enter") {
										event.preventDefault();
										handleToggle(component.type);
									}
								}}
								className={cn(
									"flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer group",
									isDragging && "opacity-50",
								)}
								role="button"
								aria-label={t("playerConfigurator.dragToReorder", {
									component: component.label,
								})}
								tabIndex={0}
							>
								<GripVertical
									className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground flex-shrink-0 transition-colors cursor-move"
									onClick={(e) => e.stopPropagation()}
									onMouseDown={(e) => e.stopPropagation()}
								/>

								<div
									className="flex items-center justify-center h-5 w-5 rounded border border-primary/50 cursor-pointer transition-colors hover:border-primary"
									onClick={(e) => {
										e.stopPropagation();
										handleToggle(component.type);
									}}
									onKeyDown={(event) => {
										if (event.key === " " || event.key === "Enter") {
											event.preventDefault();
											handleToggle(component.type);
										}
									}}
									role="checkbox"
									aria-checked={component.enabled}
									aria-label={
										component.enabled
											? t("playerConfigurator.hide")
											: t("playerConfigurator.show")
									}
									tabIndex={0}
								>
									<div
										className={cn(
											"h-3.5 w-3.5 rounded-sm flex items-center justify-center transition-all",
											component.enabled
												? "bg-primary text-primary-foreground"
												: "bg-transparent",
										)}
									>
										{component.enabled && (
											<Check className="h-3 w-3" strokeWidth={3} />
										)}
									</div>
								</div>

								<div className="flex-1 min-w-0 select-none">
									<div className="flex items-center gap-2">
										<h4
											className={cn(
												"text-sm font-medium transition-colors",
												!component.enabled &&
													"text-muted-foreground line-through decoration-border",
											)}
										>
											{component.label}
										</h4>
									</div>
									<p className="text-xs text-muted-foreground mt-0.5">
										{component.description}
									</p>
								</div>
								<div className="flex items-center gap-2">
									<span className="text-xs text-muted-foreground/50 font-mono">
										{index + 1}
									</span>
								</div>
							</div>

							{/* Drop indicator line after last item */}
							{isDragging &&
								dragOverIndex === customPlayerConfig.components.length &&
								index === customPlayerConfig.components.length - 1 && (
									<div
										className="absolute left-0 right-0 h-0.5 bg-primary rounded-full z-10 translate-y-1.5"
										style={{ top: `${(index + 1) * 72 + 12}px` }}
									/>
								)}
						</React.Fragment>
					),
				)}
			</div>

			<div className="mt-6 flex items-center justify-between gap-4">
				<p className="text-xs text-muted-foreground flex-1">
					{t("playerConfigurator.hint")}
				</p>
				<Button
					variant="outline"
					size="sm"
					onClick={handleReset}
					className="h-8 gap-2 text-xs"
				>
					<RotateCcw className="h-3.5 w-3.5" />
					{t("playerConfigurator.reset")}
				</Button>
			</div>
		</div>
	);
}
