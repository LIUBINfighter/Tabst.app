import { useCallback, useRef } from "react";
import { useAppStore } from "@/renderer/store/appStore";

interface PlayerControls {
	play: () => void;
	pause: () => void;
	stop: () => void;
	refresh: () => void;
	applyZoom: (percent: number) => void;
	applyPlaybackSpeed: (speed: number) => void;
	setMetronomeVolume: (volume: number) => void;
}

export function usePlaybackControls() {
	const controlsRef = useRef<PlayerControls | null>(null);

	const registerControls = useCallback((controls: PlayerControls) => {
		controlsRef.current = controls;
		useAppStore.getState().registerPlayerControls(controls);
	}, []);

	const unregisterControls = useCallback(() => {
		controlsRef.current = null;
		useAppStore.getState().unregisterPlayerControls();
	}, []);

	const play = useCallback(() => {
		controlsRef.current?.play();
	}, []);

	const pause = useCallback(() => {
		controlsRef.current?.pause();
	}, []);

	const stop = useCallback(() => {
		controlsRef.current?.stop();
	}, []);

	const refresh = useCallback(() => {
		controlsRef.current?.refresh();
	}, []);

	const setZoom = useCallback((percent: number) => {
		controlsRef.current?.applyZoom(percent);
	}, []);

	const setPlaybackSpeed = useCallback((speed: number) => {
		controlsRef.current?.applyPlaybackSpeed(speed);
	}, []);

	const setMetronomeVolume = useCallback((volume: number) => {
		controlsRef.current?.setMetronomeVolume(volume);
	}, []);

	return {
		registerControls,
		unregisterControls,
		play,
		pause,
		stop,
		refresh,
		setZoom,
		setPlaybackSpeed,
		setMetronomeVolume,
	};
}
