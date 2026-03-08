export interface ActiveRepoContext {
	id: string;
	name: string;
	path: string;
}

let activeRepoContext: ActiveRepoContext | null = null;

export function setActiveRepoContext(next: ActiveRepoContext | null) {
	activeRepoContext = next;
}

export function getActiveRepoContext(): ActiveRepoContext | null {
	return activeRepoContext;
}
