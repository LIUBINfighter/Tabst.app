import type {
	CloudPublicScore,
	CloudPublicScoreListItem,
} from "../types/cloud";

const SCORE_LIST_SELECT =
	"id,owner_id,title,description,tags,visibility,created_at,updated_at";
const SCORE_DETAIL_SELECT = `${SCORE_LIST_SELECT},content`;

const DEFAULT_TABST_DB_SUPABASE_URL =
	"https://fkasoumnkzrtqwqicbkg.supabase.co";
const DEFAULT_TABST_DB_SUPABASE_PUBLISHABLE_KEY =
	"sb_publishable_5lSABaAMnMM3BnPH3cAEIw_k3iMgeT5";

function getCloudSupabaseConfig() {
	const supabaseUrl =
		import.meta.env.VITE_TABST_DB_SUPABASE_URL?.trim() ||
		DEFAULT_TABST_DB_SUPABASE_URL;
	const publishableKey =
		import.meta.env.VITE_TABST_DB_SUPABASE_PUBLISHABLE_KEY?.trim() ||
		DEFAULT_TABST_DB_SUPABASE_PUBLISHABLE_KEY;

	if (!supabaseUrl || !publishableKey) {
		return null;
	}

	return { supabaseUrl, publishableKey };
}

function buildScoresUrl(select: string) {
	const config = getCloudSupabaseConfig();
	if (!config) {
		throw new Error("cloud-not-configured");
	}

	return new URL(
		`/rest/v1/scores?select=${encodeURIComponent(select)}`,
		config.supabaseUrl,
	);
}

async function readSupabaseJson<T>(url: URL): Promise<T> {
	const config = getCloudSupabaseConfig();
	if (!config) {
		throw new Error("cloud-not-configured");
	}

	const response = await fetch(url.toString(), {
		headers: {
			apikey: config.publishableKey,
			Authorization: `Bearer ${config.publishableKey}`,
		},
	});

	if (!response.ok) {
		let message = `cloud-request-failed-${response.status}`;
		try {
			const data = (await response.json()) as { message?: string };
			if (data.message) {
				message = data.message;
			}
		} catch {
			// ignore response parsing failures
		}

		throw new Error(message);
	}

	return (await response.json()) as T;
}

export async function listCloudPublicScores(
	query: string,
): Promise<CloudPublicScoreListItem[]> {
	const url = buildScoresUrl(SCORE_LIST_SELECT);
	url.searchParams.set("visibility", "eq.public");
	url.searchParams.set("order", "created_at.desc");

	if (query.trim()) {
		url.searchParams.set("title", `ilike.*${query.trim()}*`);
	}

	return readSupabaseJson<CloudPublicScoreListItem[]>(url);
}

export async function listCloudPublicScoresWithContent(): Promise<
	CloudPublicScore[]
> {
	const url = buildScoresUrl(SCORE_DETAIL_SELECT);
	url.searchParams.set("visibility", "eq.public");
	url.searchParams.set("order", "created_at.desc");

	return readSupabaseJson<CloudPublicScore[]>(url);
}

export async function getCloudPublicScore(
	id: string,
): Promise<CloudPublicScore> {
	const url = buildScoresUrl(SCORE_DETAIL_SELECT);
	url.searchParams.set("visibility", "eq.public");
	url.searchParams.set("id", `eq.${id}`);
	url.searchParams.set("limit", "1");

	const rows = await readSupabaseJson<CloudPublicScore[]>(url);
	const score = rows[0];
	if (!score) {
		throw new Error("cloud-score-not-found");
	}

	return score;
}
