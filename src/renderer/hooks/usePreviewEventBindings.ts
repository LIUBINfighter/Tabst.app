import type * as alphaTab from "@coderline/alphatab";
import { useCallback, useRef } from "react";
import type { PreviewLifecycleReason } from "./usePreviewLifecycleTelemetry";

interface BindPreviewEventsParams {
	api: alphaTab.AlphaTabApi;
	attachApiListeners: (api: alphaTab.AlphaTabApi) => void;
	incrementCounter: (
		key:
			| "listenerBound"
			| "listenerUnbound"
			| "apiCreated"
			| "apiDestroyed"
			| "rebuildRequested"
			| "rebuildCompleted"
			| "recoveryTriggered"
			| "timeoutTriggered",
	) => void;

	dumpCounters: (reason: PreviewLifecycleReason) => void;
}

interface BoundToken {
	api: alphaTab.AlphaTabApi;
	token: number;
}

export function usePreviewEventBindings() {
	const boundRef = useRef<BoundToken | null>(null);
	const seqRef = useRef(0);

	const bind = useCallback(
		({
			api,
			attachApiListeners,
			incrementCounter,
			dumpCounters,
		}: BindPreviewEventsParams) => {
			if (boundRef.current?.api === api) {
				return () => {};
			}

			seqRef.current += 1;
			const token = seqRef.current;
			attachApiListeners(api);
			boundRef.current = { api, token };
			incrementCounter("listenerBound");
			dumpCounters("listener-bound");

			return () => {
				if (
					boundRef.current &&
					boundRef.current.api === api &&
					boundRef.current.token === token
				) {
					boundRef.current = null;
					incrementCounter("listenerUnbound");
					dumpCounters("listener-unbound");
				}
			};
		},
		[],
	);

	const unbindCurrent = useCallback(
		(
			incrementCounter: BindPreviewEventsParams["incrementCounter"],
			dumpCounters: BindPreviewEventsParams["dumpCounters"],
		) => {
			if (!boundRef.current) return;
			boundRef.current = null;
			incrementCounter("listenerUnbound");
			dumpCounters("listener-unbound-force");
		},
		[],
	);

	return { bind, unbindCurrent, boundRef };
}
