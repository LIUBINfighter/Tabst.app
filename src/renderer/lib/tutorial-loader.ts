import type { MDXModule } from "mdx/types";
import type { TutorialMetadata } from "../data/tutorials";
import { tutorialsRegistry } from "../data/tutorials";

/**
 * 加载 MDX 教程组件
 * 优先尝试加载 .mdx 文件，如果不存在则回退到 .md
 */
export async function loadTutorialComponent(
	id: string,
): Promise<MDXModule | null> {
	try {
		// 尝试加载 MDX 文件
		const module = await import(`../data/tutorials/${id}.mdx`);
		return module as MDXModule;
	} catch (error) {
		// MDX 文件不存在，返回 null（让调用者处理回退）
		return null;
	}
}

/**
 * 加载教程内容（字符串格式，用于向后兼容）
 * 使用 Vite 的 ?raw 导入来加载 Markdown 文件
 */
export async function loadTutorial(id: string): Promise<string> {
	try {
		// 动态导入 Markdown 文件内容
		// Vite 会将 ?raw 后缀的文件作为字符串导入
		const module = await import(
			`../data/tutorials/${id}.md?raw`
		);
		return module.default;
	} catch (error) {
		console.error(`Failed to load tutorial: ${id}`, error);
		throw new Error(`教程文件未找到: ${id}`);
	}
}

/**
 * 获取教程元数据
 */
export function getTutorialMetadata(
	id: string,
): TutorialMetadata | undefined {
	return tutorialsRegistry.find((t) => t.id === id);
}

/**
 * 获取所有教程（按 order 排序）
 */
export function getAllTutorials(): TutorialMetadata[] {
	return [...tutorialsRegistry].sort((a, b) => a.order - b.order);
}

/**
 * 获取前一个教程
 */
export function getPrevTutorial(
	currentId: string,
): TutorialMetadata | null {
	const all = getAllTutorials();
	const currentIndex = all.findIndex((t) => t.id === currentId);
	return currentIndex > 0 ? all[currentIndex - 1] : null;
}

/**
 * 获取下一个教程
 */
export function getNextTutorial(
	currentId: string,
): TutorialMetadata | null {
	const all = getAllTutorials();
	const currentIndex = all.findIndex((t) => t.id === currentId);
	return currentIndex >= 0 && currentIndex < all.length - 1
		? all[currentIndex + 1]
		: null;
}
