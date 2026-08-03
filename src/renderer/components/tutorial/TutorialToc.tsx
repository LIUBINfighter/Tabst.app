import { ChevronUp, ListTree } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

interface TocItem {
	level: number;
	text: string;
	el: HTMLElement;
}

interface TutorialTocProps {
	scrollContainerRef: React.RefObject<HTMLDivElement | null>;
	contentRef: React.RefObject<HTMLDivElement | null>;
}

const TOP_OFFSET = 16;

export function TutorialToc({
	scrollContainerRef,
	contentRef,
}: TutorialTocProps) {
	const { t } = useTranslation(["common"]);
	const [items, setItems] = useState<TocItem[]>([]);
	const [activeIndex, setActiveIndex] = useState(0);
	const [open, setOpen] = useState(true);

	// 收集渲染后的标题（h2/h3/h4），下一帧再补一次以覆盖异步渲染的 MDX 内容
	useEffect(() => {
		const collect = () => {
			const contentEl = contentRef.current;
			if (!contentEl) return;
			const headings = Array.from(
				contentEl.querySelectorAll<HTMLElement>("h2, h3, h4"),
			).map((el) => ({
				level: Number(el.tagName[1]),
				text: el.textContent?.trim() ?? "",
				el,
			}));
			setItems(headings);
			setActiveIndex(0);
		};
		collect();
		const raf = requestAnimationFrame(collect);
		return () => cancelAnimationFrame(raf);
	}, [contentRef]);

	// 标题可能出现重复文本，按出现次数生成稳定 key
	const itemKeys = useMemo(() => {
		const seen = new Map<string, number>();
		return items.map((item) => {
			const count = seen.get(item.text) ?? 0;
			seen.set(item.text, count + 1);
			return `${item.text}#${count}`;
		});
	}, [items]);

	// 滚动高亮（scroll-spy）
	useEffect(() => {
		const scroller = scrollContainerRef.current;
		if (!scroller || items.length === 0) return;
		let rafId = 0;
		const onScroll = () => {
			cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(() => {
				const containerTop = scroller.getBoundingClientRect().top;
				const offset = TOP_OFFSET + 80;
				let current = 0;
				for (let i = 0; i < items.length; i += 1) {
					const top = items[i].el.getBoundingClientRect().top - containerTop;
					if (top <= offset) current = i;
					else break;
				}
				setActiveIndex(current);
			});
		};
		onScroll();
		scroller.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			cancelAnimationFrame(rafId);
			scroller.removeEventListener("scroll", onScroll);
		};
	}, [items, scrollContainerRef]);

	const scrollToHeading = useCallback(
		(item: TocItem) => {
			const scroller = scrollContainerRef.current;
			if (!scroller) return;
			const rect = item.el.getBoundingClientRect();
			const containerRect = scroller.getBoundingClientRect();
			scroller.scrollTo({
				top: scroller.scrollTop + (rect.top - containerRect.top) - TOP_OFFSET,
				behavior: "smooth",
			});
		},
		[scrollContainerRef],
	);

	// 只有 h1 的文章（如单页总览）没有目录项
	const hasItems = items.length > 0;

	if (!hasItems) return null;

	if (!open) {
		return (
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="absolute left-3 top-1/2 z-20 flex -translate-y-1/2 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent/40"
				aria-label={t("common:toc")}
			>
				<ListTree className="h-3.5 w-3.5" />
				<span>{t("common:toc")}</span>
			</button>
		);
	}

	return (
		<aside className="absolute left-4 top-1/2 z-20 flex max-h-[calc(100%-3rem)] w-52 -translate-y-1/2 flex-col overflow-hidden">
			<div className="px-3 pb-1">
				<span className="flex items-center gap-1.5 text-xs font-semibold text-foreground/70">
					<ListTree className="h-3.5 w-3.5 text-muted-foreground" />
					{t("common:toc")}
				</span>
			</div>
			<nav className="flex-1 overflow-auto py-1">
				{items.map((item, index) => {
					const indent =
						item.level === 2 ? "" : item.level === 3 ? "pl-4" : "pl-7";
					const isActive = index === activeIndex;
					return (
						<button
							key={itemKeys[index]}
							type="button"
							onClick={() => scrollToHeading(item)}
							className="block w-full px-3 py-0.5 text-left"
						>
							<span
								className={`block w-fit max-w-full truncate text-xs underline decoration-2 underline-offset-4 transition-colors ${indent} ${
									isActive
										? "text-primary font-medium decoration-primary/70"
										: "text-muted-foreground decoration-transparent hover:text-primary hover:decoration-current"
								}`}
							>
								{item.text}
							</span>
						</button>
					);
				})}
			</nav>
			<button
				type="button"
				onClick={() => setOpen(false)}
				className="flex w-full items-center gap-1 px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
			>
				<ChevronUp className="h-3.5 w-3.5" />
				{t("common:collapse")}
			</button>
		</aside>
	);
}
