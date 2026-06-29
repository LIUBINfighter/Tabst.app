/**
 * AlphaTab 导出工具
 * 支持导出 GP7、MIDI、WAV 格式
 */

import * as alphaTab from "@coderline/alphatab";

export type ExportFormat = "midi" | "wav" | "gp";

const DEFAULT_EXPORT_BASE_NAME = "song";

function normalizePath(path: string): string {
	return path.replace(/\\/g, "/");
}

function normalizeExtension(extension: string): string {
	return extension.trim().replace(/^\./, "").toLowerCase();
}

function splitPath(path: string): { directory?: string; fileName: string } {
	const normalized = normalizePath(path);
	const lastSlashIndex = normalized.lastIndexOf("/");

	if (lastSlashIndex < 0) {
		return { fileName: normalized };
	}

	if (lastSlashIndex === normalized.length - 1) {
		return { directory: normalized.slice(0, -1), fileName: "" };
	}

	return {
		directory: normalized.slice(0, lastSlashIndex),
		fileName: normalized.slice(lastSlashIndex + 1),
	};
}

function getFileBaseName(fileName: string): string {
	const trimmed = fileName.trim();
	if (!trimmed) {
		return DEFAULT_EXPORT_BASE_NAME;
	}

	const lastDotIndex = trimmed.lastIndexOf(".");
	if (lastDotIndex <= 0) {
		return trimmed;
	}

	return trimmed.slice(0, lastDotIndex);
}

function sanitizeFallbackBaseName(baseName: string): string {
	const sanitized = baseName
		.trim()
		.replace(/[\\/:*?"<>|]/g, "_")
		.replace(/\s+/g, " ")
		.replace(/[. ]+$/g, "");

	return sanitized || DEFAULT_EXPORT_BASE_NAME;
}

function joinPath(directory: string | undefined, fileName: string): string {
	return directory ? `${directory}/${fileName}` : fileName;
}

export function buildExportFilePath(
	sourcePath: string | undefined,
	extension: string,
	fallbackBaseName: string = DEFAULT_EXPORT_BASE_NAME,
): string {
	const normalizedExtension = normalizeExtension(extension);
	const safeFallbackBaseName = sanitizeFallbackBaseName(fallbackBaseName);

	if (!sourcePath?.trim()) {
		return `${safeFallbackBaseName}.${normalizedExtension}`;
	}

	const normalizedSourcePath = normalizePath(sourcePath.trim());
	const { directory, fileName } = splitPath(normalizedSourcePath);
	const baseName = getFileBaseName(fileName);
	const sourceExtensionIndex = fileName.lastIndexOf(".");
	const sourceExtension =
		sourceExtensionIndex > 0
			? normalizeExtension(fileName.slice(sourceExtensionIndex + 1))
			: "";
	const targetBaseName =
		sourceExtension && sourceExtension === normalizedExtension
			? `${baseName}.export`
			: baseName;

	return joinPath(directory, `${targetBaseName}.${normalizedExtension}`);
}

/**
 * 导出为 Guitar Pro 7 (.gp) 格式
 */
export function exportToGp7(api: alphaTab.AlphaTabApi): Uint8Array {
	if (!api.score) {
		throw new Error("No score loaded");
	}

	const exporter = new alphaTab.exporter.Gp7Exporter();
	return exporter.export(api.score, api.settings);
}

/**
 * 导出为 MIDI (.mid) 格式
 */
export function exportToMidi(
	api: alphaTab.AlphaTabApi,
	format: alphaTab.midi.MidiFileFormat = alphaTab.midi.MidiFileFormat
		.SingleTrackMultiChannel,
): Uint8Array {
	if (!api.score) {
		throw new Error("No score loaded");
	}

	const midiFile = new alphaTab.midi.MidiFile();
	midiFile.format = format;
	const handler = new alphaTab.midi.AlphaSynthMidiFileHandler(midiFile, true);
	const generator = new alphaTab.midi.MidiFileGenerator(
		api.score,
		api.settings,
		handler,
	);
	generator.generate();
	return midiFile.toBinary();
}

/**
 * 导出为 WAV (.wav) 格式
 */
export async function exportToWav(
	api: alphaTab.AlphaTabApi,
	onProgress?: (progress: number) => void,
): Promise<Uint8Array> {
	if (!api.score) {
		throw new Error("No score loaded");
	}

	const sampleRate = 44100;

	const exportOptions = new alphaTab.synth.AudioExportOptions();
	exportOptions.sampleRate = sampleRate;
	exportOptions.useSyncPoints = true;
	exportOptions.masterVolume = api.masterVolume;
	exportOptions.metronomeVolume = api.countInVolume;
	exportOptions.trackVolume = new Map<number, number>();
	exportOptions.trackTranspositionPitches = new Map<number, number>();

	for (let i = 0; i < api.score.tracks.length; i++) {
		exportOptions.trackVolume.set(i, 1.0);
		exportOptions.trackTranspositionPitches.set(i, 0);
	}

	const exporter = await api.exportAudio(exportOptions);

	try {
		const chunks: Float32Array[] = [];
		const chunkDurationMs = 100;

		while (true) {
			const chunk = await exporter.render(chunkDurationMs);
			if (!chunk) break;

			chunks.push(chunk.samples);

			if (onProgress && chunk.endTime > 0) {
				onProgress(chunk.currentTime / chunk.endTime);
			}
		}

		const totalSamples = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
		const audioData = new Float32Array(totalSamples);
		let offset = 0;
		for (const chunk of chunks) {
			audioData.set(chunk, offset);
			offset += chunk.length;
		}

		const wavData = float32ArrayToWav(audioData, sampleRate);
		onProgress?.(1);
		return new Uint8Array(wavData);
	} finally {
		exporter.destroy();
	}
}

/**
 * 将 Float32Array 音频数据转换为 WAV 格式
 */
function float32ArrayToWav(
	float32Array: Float32Array,
	sampleRate: number,
): ArrayBuffer {
	const numChannels = 2; // 立体声
	const numFrames = float32Array.length / numChannels;
	const bytesPerSample = 2; // 16-bit
	const blockAlign = numChannels * bytesPerSample;
	const byteRate = sampleRate * blockAlign;

	// WAV 文件头大小 + 数据大小
	const dataSize = numFrames * blockAlign;
	const buffer = new ArrayBuffer(44 + dataSize);
	const view = new DataView(buffer);

	// 写入 WAV 文件头
	// "RIFF" chunk
	writeString(view, 0, "RIFF");
	view.setUint32(4, 36 + dataSize, true);
	writeString(view, 8, "WAVE");

	// "fmt " sub-chunk
	writeString(view, 12, "fmt ");
	view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
	view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
	view.setUint16(22, numChannels, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, byteRate, true);
	view.setUint16(32, blockAlign, true);
	view.setUint16(34, 16, true); // BitsPerSample

	// "data" sub-chunk
	writeString(view, 36, "data");
	view.setUint32(40, dataSize, true);

	// 写入音频数据 (Float32 -> Int16)
	let offset = 44;
	for (let i = 0; i < float32Array.length; i++) {
		const sample = Math.max(-1, Math.min(1, float32Array[i]));
		const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
		view.setInt16(offset, int16, true);
		offset += 2;
	}

	return buffer;
}

/**
 * 在 DataView 中写入字符串
 */
function writeString(view: DataView, offset: number, string: string): void {
	for (let i = 0; i < string.length; i++) {
		view.setUint8(offset + i, string.charCodeAt(i));
	}
}

/**
 * 获取默认导出文件名（基于当前打开的文件名）
 */
export function getDefaultExportFilename(
	activeFileName: string | undefined,
	extension: string,
): string {
	if (!activeFileName) {
		return `song.${extension}`;
	}

	// 移除原扩展名，添加新扩展名
	const baseName = activeFileName.replace(/\.[^/.]+$/, "");
	return `${baseName}.${extension}`;
}
