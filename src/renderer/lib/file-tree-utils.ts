import type { FileNode } from "../types/repo";

/**
 * 遍历文件树，收集所有文件节点（保留树的展开顺序）。
 */
export function collectFileNodes(nodes: FileNode[]): FileNode[] {
	const result: FileNode[] = [];
	for (const node of nodes) {
		if (node.type === "file") {
			result.push(node);
		} else if (node.children) {
			result.push(...collectFileNodes(node.children));
		}
	}
	return result;
}

/**
 * 收集树中所有文件节点的 normalized path 集合。
 */
export function collectFilePaths(
	nodes: FileNode[],
	normalize: (p: string) => string,
): Set<string> {
	const result = new Set<string>();
	for (const node of collectFileNodes(nodes)) {
		result.add(normalize(node.path));
	}
	return result;
}
