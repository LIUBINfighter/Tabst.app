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

function isRecoverableAudioState(state: string | undefined): boolean {
	return state === "suspended" || state === "interrupted";
}

export async function prepareAlphaTabAudioForPlayback(
	api: RecoverableAlphaTabApiLike,
): Promise<AudioRecoveryResult> {
	const output = api.player?.output;
	if (!output?.activate) {
		return {
			didAttemptActivation: false,
			initialState: output?.context?.state ?? null,
			finalState: output?.context?.state ?? null,
		};
	}

	const initialState = output.context?.state ?? null;

	if (isRecoverableAudioState(output.context?.state)) {
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

			window.setTimeout(finish, 150);
		});

		if (
			isRecoverableAudioState(output.context?.state) &&
			output.context?.resume
		) {
			try {
				await output.context.resume();
			} catch {}
		}
	} else {
		try {
			output.activate();
		} catch {}
	}

	return {
		didAttemptActivation: true,
		initialState,
		finalState: output.context?.state ?? null,
	};
}
