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

function isRecoverableAudioState(state: string | undefined): boolean {
	return state === "suspended" || state === "interrupted";
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
	let didAttemptActivation = false;

	if (isRecoverableAudioState(output.context?.state)) {
		didAttemptActivation =
			(await tryActivateOutput(output)) || didAttemptActivation;
		didAttemptActivation =
			(await tryResumeContext(output.context)) || didAttemptActivation;

		if (isRecoverableAudioState(output.context?.state)) {
			didAttemptActivation =
				(await tryActivateOutput(output)) || didAttemptActivation;
			didAttemptActivation =
				(await tryResumeContext(output.context)) || didAttemptActivation;
		}
	} else {
		didAttemptActivation =
			(await tryActivateOutput(output)) || didAttemptActivation;
		if (output.context?.state !== "running") {
			didAttemptActivation =
				(await tryResumeContext(output.context)) || didAttemptActivation;
		}
	}

	return {
		didAttemptActivation,
		initialState,
		finalState: output.context?.state ?? null,
	};
}
