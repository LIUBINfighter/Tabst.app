import { ImagePlus } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "./button";

const SUPPORTED_IMAGE_TYPES = new Set([
	"image/png",
	"image/jpeg",
	"image/jpg",
	"image/webp",
]);

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export interface ImageDropzoneProps {
	onImage: (dataUrl: string) => void;
	onError: (message: string) => void;
	selectLabel: string;
	dropLabel: string;
	dropHint: string;
}

function isSupportedImage(file: File): boolean {
	return SUPPORTED_IMAGE_TYPES.has(file.type);
}

function readImageFile(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result === "string") {
				resolve(reader.result);
				return;
			}
			reject(new Error("Failed to read image data"));
		};
		reader.onerror = () => reject(new Error("Failed to read image data"));
		reader.readAsDataURL(file);
	});
}

async function loadImageFile(file: File): Promise<string> {
	if (!isSupportedImage(file)) {
		throw new Error("image-format-unsupported");
	}
	if (file.size > MAX_IMAGE_BYTES) {
		throw new Error("image-too-large");
	}
	return readImageFile(file);
}

export function ImageDropzone({
	onImage,
	onError,
	selectLabel,
	dropLabel,
	dropHint,
}: ImageDropzoneProps) {
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [dragActive, setDragActive] = useState(false);

	const handleFile = useCallback(
		async (file: File | undefined) => {
			if (!file) return;
			try {
				onImage(await loadImageFile(file));
			} catch (error) {
				onError(error instanceof Error ? error.message : String(error));
			}
		},
		[onError, onImage],
	);

	return (
		<div
			role="button"
			tabIndex={0}
			className={`rounded border border-dashed p-6 transition-colors ${
				dragActive
					? "border-primary bg-primary/10"
					: "border-border bg-muted/20"
			}`}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					inputRef.current?.click();
				}
			}}
			onDragEnter={(event) => {
				event.preventDefault();
				setDragActive(true);
			}}
			onDragOver={(event) => {
				event.preventDefault();
				setDragActive(true);
			}}
			onDragLeave={(event) => {
				event.preventDefault();
				setDragActive(false);
			}}
			onDrop={(event) => {
				event.preventDefault();
				setDragActive(false);
				void handleFile(event.dataTransfer.files[0]);
			}}
		>
			<div className="flex flex-col items-center gap-3 text-center">
				<div className="rounded-full bg-primary/10 p-3 text-primary">
					<ImagePlus className="h-5 w-5" />
				</div>
				<div>
					<p className="text-sm font-medium">{dropLabel}</p>
					<p className="text-xs text-muted-foreground">{dropHint}</p>
				</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => inputRef.current?.click()}
				>
					{selectLabel}
				</Button>
				<input
					ref={inputRef}
					type="file"
					accept="image/png,image/jpg,image/jpeg,image/webp"
					className="hidden"
					onChange={(event) => {
						void handleFile(event.currentTarget.files?.[0]);
						event.currentTarget.value = "";
					}}
				/>
			</div>
		</div>
	);
}
