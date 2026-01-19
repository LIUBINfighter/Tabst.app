interface TutorialImageProps {
	src: string;
	alt?: string;
	title?: string;
}

export function TutorialImage({ src, alt, title }: TutorialImageProps) {
	// 处理图片路径：支持相对路径和绝对路径
	// 如果 src 是相对路径，假设图片在 public/tutorials/images/ 目录下
	const imageSrc =
		src.startsWith("/") || src.startsWith("http")
			? src
			: `/tutorials/images/${src}`;

	return (
		<figure className="my-4">
			<img
				src={imageSrc}
				alt={alt || ""}
				title={title}
				className="max-w-full h-auto rounded-lg border border-border"
				loading="lazy"
			/>
			{title && (
				<figcaption className="mt-2 text-xs text-muted-foreground text-center">
					{title}
				</figcaption>
			)}
		</figure>
	);
}
