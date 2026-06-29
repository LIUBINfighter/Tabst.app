export interface CloudPublicScoreListItem {
	id: string;
	owner_id: string;
	title: string;
	description: string;
	tags: string[];
	visibility: "public";
	created_at: string;
	updated_at: string;
}

export interface CloudPublicScore extends CloudPublicScoreListItem {
	content: string;
}
