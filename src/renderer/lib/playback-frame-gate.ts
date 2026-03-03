export interface FrameGateScheduler {
	request(callback: () => void): number;
	cancel(id: number): void;
	now(): number;
}

export interface PlaybackFrameGateOptions {
	minIntervalMs?: number;
	scheduler?: FrameGateScheduler;
}

export interface PlaybackFrameGate<T> {
	push(value: T): void;
	dispose(): void;
	hasPending(): boolean;
}

const fallbackRequest = (callback: () => void): number => {
	if (
		typeof window !== "undefined" &&
		typeof window.requestAnimationFrame === "function"
	) {
		return window.requestAnimationFrame(callback);
	}
	return globalThis.setTimeout(callback, 0) as unknown as number;
};

const fallbackCancel = (id: number): void => {
	if (
		typeof window !== "undefined" &&
		typeof window.cancelAnimationFrame === "function"
	) {
		window.cancelAnimationFrame(id);
		return;
	}
	globalThis.clearTimeout(id);
};

const fallbackNow = (): number => {
	if (
		typeof performance !== "undefined" &&
		typeof performance.now === "function"
	) {
		return performance.now();
	}
	return Date.now();
};

const defaultScheduler: FrameGateScheduler = {
	request: fallbackRequest,
	cancel: fallbackCancel,
	now: fallbackNow,
};

export function createPlaybackFrameGate<T>(
	onFlush: (value: T) => void,
	options: PlaybackFrameGateOptions = {},
): PlaybackFrameGate<T> {
	const scheduler = options.scheduler ?? defaultScheduler;
	const minIntervalMs = Math.max(0, options.minIntervalMs ?? 0);

	let pendingValue: T | null = null;
	let hasValue = false;
	let disposed = false;
	let frameId: number | null = null;
	let lastFlushAt = -Infinity;

	const flush = () => {
		frameId = null;
		if (disposed || !hasValue) {
			return;
		}

		const now = scheduler.now();
		if (now - lastFlushAt < minIntervalMs) {
			frameId = scheduler.request(flush);
			return;
		}

		lastFlushAt = now;
		hasValue = false;
		const value = pendingValue;
		pendingValue = null;
		if (value !== null) {
			onFlush(value);
		}
	};

	return {
		push(value: T) {
			if (disposed) return;
			pendingValue = value;
			hasValue = true;
			if (frameId === null) {
				frameId = scheduler.request(flush);
			}
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			if (frameId !== null) {
				scheduler.cancel(frameId);
				frameId = null;
			}
			hasValue = false;
			pendingValue = null;
		},
		hasPending() {
			return hasValue;
		},
	};
}
