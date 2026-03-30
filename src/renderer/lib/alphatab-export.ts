/**
 * AlphaTab 导出工具
 * 支持导出 GP7、MIDI、WAV 格式
 */

import * as alphaTab from "@coderline/alphatab";

import { createPreviewSettings } from "./alphatab-config";
import { loadBravuraFont, loadSoundFontFromUrl } from "./assets";
import { getResourceUrls } from "./resourceLoaderService";

const TEMP_API_TIMEOUT_MS = 20000;

function ensureScoreLoaded(api: alphaTab.AlphaTabApi): alphaTab.model.Score {
	if (!api.score) {
		throw new Error("No score loaded");
	}

	return api.score;
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	document.body.removeChild(anchor);
	URL.revokeObjectURL(url);
}

function createMidiBytesFromScore(
	score: alphaTab.model.Score,
	settings?: alphaTab.Settings | null,
): Uint8Array {
	const midiFile = new alphaTab.midi.MidiFile();
	const handler = new alphaTab.midi.AlphaSynthMidiFileHandler(midiFile, true);
	const generator = new alphaTab.midi.MidiFileGenerator(
		score,
		settings ?? null,
		handler,
	);
	generator.generate();
	const bytes = midiFile.toBinary();
	return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(
		bytes.byteOffset,
		bytes.byteOffset + bytes.byteLength,
	) as ArrayBuffer;
}

function loadScoreFromAlphaTex(sourceText: string): {
	score: alphaTab.model.Score;
	settings: alphaTab.Settings;
} {
	const importer = new alphaTab.importer.AlphaTexImporter();
	const settings = new alphaTab.Settings();
	importer.initFromString(sourceText, settings);
	const score = importer.readScore();
	return { score, settings };
}

function waitForEvent(
	emitter:
		| {
				on: (
					listener: (...args: unknown[]) => void,
				) => (() => void) | undefined;
		  }
		| undefined,
	errorMessage: string,
	timeoutMs = TEMP_API_TIMEOUT_MS,
): Promise<void> {
	return new Promise((resolve, reject) => {
		if (!emitter?.on) {
			reject(new Error(errorMessage));
			return;
		}

		let settled = false;
		let unsubscribe: (() => void) | undefined;
		const timeoutId = window.setTimeout(() => {
			if (settled) return;
			settled = true;
			if (typeof unsubscribe === "function") {
				unsubscribe();
			}
			reject(new Error(errorMessage));
		}, timeoutMs);

		unsubscribe = emitter.on(() => {
			if (settled) return;
			settled = true;
			window.clearTimeout(timeoutId);
			if (typeof unsubscribe === "function") {
				unsubscribe();
			}
			resolve();
		});
	});
}

async function withTemporaryAlphaTabApi<T>(
	sourceText: string,
	run: (api: alphaTab.AlphaTabApi) => Promise<T>,
): Promise<T> {
	const urls = await getResourceUrls();
	await loadBravuraFont(urls.bravuraFontUrl);

	const container = document.createElement("div");
	container.setAttribute("aria-hidden", "true");
	container.style.position = "fixed";
	container.style.left = "-10000px";
	container.style.top = "0";
	container.style.width = "1px";
	container.style.height = "1px";
	container.style.opacity = "0";
	container.style.pointerEvents = "none";
	document.body.appendChild(container);

	const settings = createPreviewSettings(urls, { enablePlayer: true });
	const api = new alphaTab.AlphaTabApi(container, settings);

	try {
		const errorPromise = waitForEvent(
			api.error,
			"alphaTab export failed before completion",
		).then(() => {
			throw new Error("alphaTab export failed before completion");
		});
		const scoreLoadedPromise = waitForEvent(
			api.scoreLoaded,
			"Timed out waiting for alphaTab score load",
		);
		const soundFontLoadedPromise = waitForEvent(
			api.soundFontLoaded,
			"Timed out waiting for alphaTab soundfont load",
		);

		const soundFontRequested = await loadSoundFontFromUrl(
			api,
			urls.soundFontUrl,
		);
		if (!soundFontRequested) {
			throw new Error("Failed to load alphaTab soundfont for audio export");
		}

		api.tex(sourceText);
		await Promise.race([
			errorPromise,
			Promise.all([scoreLoadedPromise, soundFontLoadedPromise]),
		]);

		ensureScoreLoaded(api);
		return await run(api);
	} finally {
		api.destroy();
		container.remove();
	}
}

export function generateMidiBytesFromApi(
	api: alphaTab.AlphaTabApi,
): Uint8Array {
	return createMidiBytesFromScore(ensureScoreLoaded(api), api.settings);
}

export function generateMidiBytesFromAlphaTex(sourceText: string): Uint8Array {
	const { score, settings } = loadScoreFromAlphaTex(sourceText);
	return createMidiBytesFromScore(score, settings);
}

/**
 * 导出为 Guitar Pro 7 (.gp) 格式
 */
export function exportToGp7(
	api: alphaTab.AlphaTabApi,
	filename: string = "song.gp",
): void {
	const score = ensureScoreLoaded(api);

	const exporter = new alphaTab.exporter.Gp7Exporter();
	const data = exporter.export(score, api.settings);

	const blob = new Blob([data.buffer as ArrayBuffer], {
		type: "application/octet-stream",
	});
	triggerBrowserDownload(
		blob,
		filename.endsWith(".gp") ? filename : `${filename}.gp`,
	);
}

/**
 * 导出为 MIDI (.mid) 格式
 */
export function exportToMidi(api: alphaTab.AlphaTabApi): void {
	const blob = new Blob([toArrayBuffer(generateMidiBytesFromApi(api))], {
		type: "audio/midi",
	});
	triggerBrowserDownload(blob, "song.mid");
}

/**
 * 导出为 WAV (.wav) 格式
 */
export async function generateWavBytesFromApi(
	api: alphaTab.AlphaTabApi,
	onProgress?: (progress: number) => void,
): Promise<Uint8Array> {
	const score = ensureScoreLoaded(api);

	const sampleRate = 44100;

	const exportOptions = new alphaTab.synth.AudioExportOptions();
	exportOptions.sampleRate = sampleRate;
	exportOptions.useSyncPoints = true;
	exportOptions.masterVolume = api.masterVolume;
	exportOptions.metronomeVolume = api.countInVolume;
	exportOptions.trackVolume = new Map<number, number>();
	exportOptions.trackTranspositionPitches = new Map<number, number>();

	for (let i = 0; i < score.tracks.length; i++) {
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
		return new Uint8Array(wavData);
	} finally {
		exporter.destroy();
	}
}

export async function exportToWav(
	api: alphaTab.AlphaTabApi,
	filename: string = "song.wav",
	onProgress?: (progress: number) => void,
): Promise<void> {
	const wavData = await generateWavBytesFromApi(api, onProgress);
	const blob = new Blob([toArrayBuffer(wavData)], { type: "audio/wav" });
	triggerBrowserDownload(
		blob,
		filename.endsWith(".wav") ? filename : `${filename}.wav`,
	);
}

export async function generateWavBytesFromAlphaTex(
	sourceText: string,
	onProgress?: (progress: number) => void,
): Promise<Uint8Array> {
	return withTemporaryAlphaTabApi(sourceText, async (api) =>
		generateWavBytesFromApi(api, onProgress),
	);
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
