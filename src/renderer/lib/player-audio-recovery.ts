interface RecoverableAudioContextLike {
	state?: string;
	resume?: () => Promise<void>;
}

interface RecoverableAudioOutputLike {
	context?: RecoverableAudioContextLike | null;
	activate?: (resumedCallback?: () => void) => void;
}

interface RecoverableAlphaTabPlayerLike {
	output?: RecoverableAudioOutputLike | null;
}

export interface RecoverableAlphaTabApiLike {
	player?: RecoverableAlphaTabPlayerLike | null;
}

export interface AudioRecoveryResult {
	didAttemptActivation: boolean;
	initialState: string | null;
	finalState: string | null;
}

function triggerOutputActivation(output: RecoverableAudioOutputLike): boolean {
	if (!output.activate) {
		return false;
	}

	try {
		output.activate(() => {});
		return true;
	} catch {
		return false;
	}
}

function triggerContextResumeWithoutAwait(
	context: RecoverableAudioContextLike | null | undefined,
): boolean {
	if (!context?.resume) {
		return false;
	}

	try {
		void context.resume().catch(() => {});
		return true;
	} catch {
		return false;
	}
}

export function primeAlphaTabAudioOnUserGesture(
	api: RecoverableAlphaTabApiLike,
): boolean {
	const output = api.player?.output;
	if (!output) {
		return false;
	}

	let didAttemptActivation = false;
	didAttemptActivation =
		triggerOutputActivation(output) || didAttemptActivation;
	didAttemptActivation =
		triggerContextResumeWithoutAwait(output.context) || didAttemptActivation;

	return didAttemptActivation;
}

async function tryActivateOutput(
	output: RecoverableAudioOutputLike,
): Promise<boolean> {
	if (!output.activate) {
		return false;
	}

	await new Promise<void>((resolve) => {
		let settled = false;
		const finish = () => {
			if (settled) {
				return;
			}
			settled = true;
			resolve();
		};

		try {
			output.activate?.(finish);
		} catch {
			finish();
			return;
		}

		globalThis.setTimeout(finish, 150);
	});

	return true;
}

async function tryResumeContext(
	context: RecoverableAudioContextLike | null | undefined,
): Promise<boolean> {
	if (!context?.resume) {
		return false;
	}

	try {
		await context.resume();
		return true;
	} catch {
		return false;
	}
}

export async function prepareAlphaTabAudioForPlayback(
	api: RecoverableAlphaTabApiLike,
): Promise<AudioRecoveryResult> {
	const output = api.player?.output;
	if (!output) {
		return {
			didAttemptActivation: false,
			initialState: null,
			finalState: null,
		};
	}

	const initialState = output.context?.state ?? null;

	// Already running: alphaTab's activate() only invokes the callback after
	// resuming a suspended/interrupted context, so calling it here would just
	// burn the fallback timeout for no effect.
	if (initialState === "running") {
		return {
			didAttemptActivation: false,
			initialState,
			finalState: "running",
		};
	}

	// Missing context, suspended or interrupted: try to activate (this creates
	// the context and resumes it). Fall back to a direct resume when
	// activation is unavailable or did not transition to running.
	if (
		initialState === null ||
		initialState === "suspended" ||
		initialState === "interrupted"
	) {
		let didAttemptActivation = await tryActivateOutput(output);
		if (output.context?.state !== "running") {
			didAttemptActivation =
				(await tryResumeContext(output.context)) || didAttemptActivation;
		}

		return {
			didAttemptActivation,
			initialState,
			finalState: output.context?.state ?? null,
		};
	}

	// closed (or any other terminal state): cannot be recovered in place.
	// Report it as-is so the caller can rebuild the soundfont/player.
	return {
		didAttemptActivation: false,
		initialState,
		finalState: initialState,
	};
}
