interface RuntimeModeOptions {
	nodeEnv?: string;
	isPackaged: boolean;
	forceProductionWindow?: string | boolean;
}

export function isDevelopmentRuntime({
	nodeEnv,
	isPackaged,
	forceProductionWindow,
}: RuntimeModeOptions): boolean {
	const isForcedProduction =
		forceProductionWindow === true || forceProductionWindow === "1";

	if (isForcedProduction) {
		return false;
	}

	return nodeEnv === "development" || !isPackaged;
}
