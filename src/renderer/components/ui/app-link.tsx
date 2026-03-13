import type { ComponentPropsWithoutRef, MouseEvent } from "react";
import {
	isExternalHref,
	isHashHref,
	normalizeExternalHref,
	type RepoLinkContext,
	resolveRepoRelativeHref,
} from "../../lib/repo-links";

type AnchorProps = Omit<ComponentPropsWithoutRef<"a">, "href">;

export interface AppLinkProps extends AnchorProps, RepoLinkContext {
	href?: string;
}

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>): boolean {
	return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

export function AppLink({
	href,
	sourcePath,
	repoUrl,
	repoBranch,
	onClick,
	target,
	rel,
	...props
}: AppLinkProps) {
	const resolvedHref =
		typeof href === "string"
			? resolveRepoRelativeHref(href, {
					sourcePath,
					repoUrl,
					repoBranch,
				})
			: href;
	const normalizedHref =
		typeof resolvedHref === "string"
			? normalizeExternalHref(resolvedHref)
			: resolvedHref;
	const opensOutsideApp =
		typeof normalizedHref === "string" &&
		!isHashHref(normalizedHref) &&
		isExternalHref(normalizedHref);
	const resolvedTarget = target ?? (opensOutsideApp ? "_blank" : undefined);
	const resolvedRel =
		rel ?? (resolvedTarget === "_blank" ? "noopener noreferrer" : undefined);

	const handleClick = async (event: MouseEvent<HTMLAnchorElement>) => {
		onClick?.(event);
		if (event.defaultPrevented || !normalizedHref || isModifiedClick(event)) {
			return;
		}
		if (event.button !== 0 || !opensOutsideApp) {
			return;
		}

		event.preventDefault();
		const result = await window.desktopAPI?.openExternal?.(normalizedHref);
		if (result?.success === false) {
			console.error(
				"[AppLink] failed to open external link",
				result.error,
				normalizedHref,
			);
		}
	};

	return (
		<a
			{...props}
			href={normalizedHref}
			target={resolvedTarget}
			rel={resolvedRel}
			onClick={(event) => {
				void handleClick(event);
			}}
		/>
	);
}
