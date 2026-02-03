import type { MDXModule } from "mdx/types";
import type { TutorialMetadata } from "../data/tutorials";
import { tutorialsRegistry } from "../data/tutorials";

/**
 * 使用 import.meta.glob 预声明所有教程模块，确保打包后（app.asar）也能正确加载。
 * 动态 import(\`...\${id}.mdx\`) 在 Vite 构建时无法被正确解析，会导致生产环境 ERR_FILE_NOT_FOUND。
 */
const mdxGlob = import.meta.glob<MDXModule>("../data/tutorials/**/*.mdx");
const mdGlob = import.meta.glob<string>("../data/tutorials/**/*.md", {
	query: "?raw",
	import: "default",
});

function getMdxCandidates(id: string): string[] {
	return [
		`../data/tutorials/en/${id}.mdx`,
		`../data/tutorials/zh-cn/${id}.mdx`,
		`../data/tutorials/${id}.mdx`,
	];
}

function getMdCandidates(id: string): string[] {
	return [
		`../data/tutorials/en/${id}.md`,
		`../data/tutorials/zh-cn/${id}.md`,
		`../data/tutorials/${id}.md`,
	];
}

/**
 * 加载 MDX 教程组件
 * 优先尝试加载 .mdx 文件，如果不存在则回退到 .md
 */
export async function loadTutorialComponent(
	id: string,
): Promise<MDXModule | null> {
	// 按语言优先级尝试加载：en -> zh-cn -> 根目录（兼容旧路径）
	for (const p of getMdxCandidates(id)) {
		const loader = mdxGlob[p];
		if (loader) {
			const module = await loader();
			return module as MDXModule;
		}
	}
	return null;
}

/**
 * 加载教程内容（字符串格式，用于向后兼容）
 * 使用 Vite 的 ?raw 导入来加载 Markdown 文件
 */
export async function loadTutorial(id: string): Promise<string> {
	// 按语言优先级尝试加载原始 Markdown 文本：en -> zh-cn -> 根目录
	for (const p of getMdCandidates(id)) {
		const loader = mdGlob[p];
		if (loader) {
			const content = await loader();
			return content;
		}
	}
	console.error(`Failed to load tutorial: ${id}`);
	throw new Error(`教程文件未找到: ${id}`);
}

/**
 * 获取教程元数据
 */
export function getTutorialMetadata(id: string): TutorialMetadata | undefined {
	return tutorialsRegistry.find((t) => t.id === id);
}

/**
 * 判断教程是否已发布（仅显式标注为 'release' 时视为已发布）
 */
export function isReleased(t: TutorialMetadata): boolean {
	// 缺省视为草稿（未标注不可见），只有显式标注为 'release' 才显示
	return t.status === "release";
}

/**
 * 获取已发布的教程（按 order 排序）
 */
export function getReleasedTutorials(): TutorialMetadata[] {
	return [...tutorialsRegistry]
		.filter(isReleased)
		.sort((a, b) => a.order - b.order);
}

/**
 * 获取所有教程（按 order 排序）
 */
export function getAllTutorials(): TutorialMetadata[] {
	return [...tutorialsRegistry].sort((a, b) => a.order - b.order);
}

/**
 * 获取前一个教程（基于已发布列表）
 */
export function getPrevTutorial(currentId: string): TutorialMetadata | null {
	const all = getReleasedTutorials();
	const currentIndex = all.findIndex((t) => t.id === currentId);
	return currentIndex > 0 ? all[currentIndex - 1] : null;
}

/**
 * 获取下一个教程（基于已发布列表）
 */
export function getNextTutorial(currentId: string): TutorialMetadata | null {
	const all = getReleasedTutorials();
	const currentIndex = all.findIndex((t) => t.id === currentId);
	return currentIndex >= 0 && currentIndex < all.length - 1
		? all[currentIndex + 1]
		: null;
}
