import { useCallback, useRef } from "react";

export type PreviewLifecycleState =
	| "idle"
	| "initializing"
	| "ready"
	| "rebuilding"
	| "destroyed"
	| "error";

export type PreviewLifecycleReason =
	| "initAlphaTab-start"
	| "theme-observer"
	| "theme-rebuild-complete"
	| "initAlphaTab-done-noop"
	| "init-done-noop-tex"
	| "initAlphaTab-done-empty-noop"
	| "init-done-empty-noop"
	| "initAlphaTab-done"
	| "init-done"
	| "initAlphaTab-error"
	| "preview-unmount"
	| "listener-bound"
	| "listener-unbound"
	| "listener-unbound-force";

interface PreviewLifecycleCounters {
	apiCreated: number;
	apiDestroyed: number;
	listenerBound: number;
	listenerUnbound: number;
	rebuildRequested: number;
	rebuildCompleted: number;
	recoveryTriggered: number;
	timeoutTriggered: number;
}

export function usePreviewLifecycleTelemetry() {
	const lifecycleStateRef = useRef<PreviewLifecycleState>("idle");
	const countersRef = useRef<PreviewLifecycleCounters>({
		apiCreated: 0,
		apiDestroyed: 0,
		listenerBound: 0,
		listenerUnbound: 0,
		rebuildRequested: 0,
		rebuildCompleted: 0,
		recoveryTriggered: 0,
		timeoutTriggered: 0,
	});

	const transition = useCallback(
		(next: PreviewLifecycleState, reason: PreviewLifecycleReason) => {
			const prev = lifecycleStateRef.current;
			lifecycleStateRef.current = next;
			if (import.meta.env.DEV) {
				console.info(`[PreviewLifecycle] ${prev} -> ${next} (${reason})`);
			}
		},
		[],
	);

	const increment = useCallback((key: keyof PreviewLifecycleCounters) => {
		countersRef.current[key] += 1;
	}, []);

	const dumpCounters = useCallback((reason: PreviewLifecycleReason) => {
		if (!import.meta.env.DEV) return;
		console.info(`[PreviewLifecycle] counters (${reason})`, {
			state: lifecycleStateRef.current,
			...countersRef.current,
		});
	}, []);

	return {
		lifecycleStateRef,
		countersRef,
		transition,
		increment,
		dumpCounters,
	};
}
