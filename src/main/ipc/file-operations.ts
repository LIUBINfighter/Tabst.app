import fs from "node:fs";
import path from "node:path";
import { dialog } from "electron";

const _ALLOWED_EXTENSIONS = [".md", ".atex"];

export async function handleOpenFile(
	_event: Electron.IpcMainInvokeEvent,
	extensions: string[],
) {
	const filters = [
		{
			name: "支持的文件",
			extensions: extensions.map((ext) => ext.replace(".", "")),
		},
	];

	const result = await dialog.showOpenDialog({
		properties: ["openFile"],
		filters,
	});

	if (result.canceled || result.filePaths.length === 0) {
		return null;
	}

	const filePath = result.filePaths[0];
	const content = fs.readFileSync(filePath, "utf-8");
	const name = path.basename(filePath);

	return { path: filePath, name, content };
}

export async function handleCreateFile(
	_event: Electron.IpcMainInvokeEvent,
	ext?: string,
) {
	const { app } = await import("electron");
	const documentsDir = app.getPath("documents");
	const tabstDir = path.join(documentsDir, "tabst");

	if (!fs.existsSync(tabstDir)) {
		fs.mkdirSync(tabstDir, { recursive: true });
	}

	let normalizedExt = ".md";
	if (ext && typeof ext === "string") {
		normalizedExt = ext.startsWith(".") ? ext : `.${ext}`;
	}

	const timestamp = Date.now();
	const fileName = `untitled_${timestamp}${normalizedExt}`;
	const filePath = path.join(tabstDir, fileName);

	fs.writeFileSync(filePath, "", "utf-8");

	return { path: filePath, name: fileName, content: "" };
}

export async function handleSaveFile(
	_event: Electron.IpcMainInvokeEvent,
	filePath: string,
	content: string,
) {
	try {
		fs.writeFileSync(filePath, content, "utf-8");
		return { success: true };
	} catch (error) {
		console.error("保存文件失败:", error);
		return { success: false, error: String(error) };
	}
}

export async function handleRenameFile(
	_event: Electron.IpcMainInvokeEvent,
	oldPath: string,
	newName: string,
) {
	try {
		const dir = path.dirname(oldPath);
		const newPath = path.join(dir, newName);

		if (newPath === oldPath) {
			return { success: true, newPath, newName: path.basename(newPath) };
		}

		if (fs.existsSync(newPath)) {
			return { success: false, error: "target-exists" };
		}

		await fs.promises.copyFile(oldPath, newPath);
		await fs.promises.unlink(oldPath);

		return { success: true, newPath, newName: path.basename(newPath) };
	} catch (err) {
		console.error("rename-file failed:", err);
		return { success: false, error: String(err) };
	}
}
