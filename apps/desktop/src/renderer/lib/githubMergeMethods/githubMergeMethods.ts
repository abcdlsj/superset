export const MERGE_METHODS = ["squash", "merge", "rebase"] as const;

export type MergeMethod = (typeof MERGE_METHODS)[number];

export interface GitHubMergeSettings {
	allowMergeCommit?: boolean | null;
	allowRebaseMerge?: boolean | null;
	allowSquashMerge?: boolean | null;
	viewerDefaultMergeMethod?: string | null;
}

export const MERGE_METHOD_LABELS: Record<MergeMethod, string> = {
	merge: "Create merge commit",
	rebase: "Rebase and merge",
	squash: "Squash and merge",
};

function hasCompleteMergeSettings(
	settings: GitHubMergeSettings | null | undefined,
): settings is GitHubMergeSettings & {
	allowMergeCommit: boolean;
	allowRebaseMerge: boolean;
	allowSquashMerge: boolean;
} {
	return (
		typeof settings?.allowMergeCommit === "boolean" &&
		typeof settings.allowRebaseMerge === "boolean" &&
		typeof settings.allowSquashMerge === "boolean"
	);
}

function normalizeMergeMethod(
	value: string | null | undefined,
): MergeMethod | null {
	const normalized = value?.toLowerCase();
	return normalized === "merge" ||
		normalized === "rebase" ||
		normalized === "squash"
		? normalized
		: null;
}

/**
 * Returns the methods that GitHub allows, with the viewer's default first
 * when it is available. An incomplete response is treated as unavailable so
 * a transient settings failure never removes the merge menu options.
 */
export function getAvailableMergeMethods(
	settings: GitHubMergeSettings | null | undefined,
): MergeMethod[] {
	if (!hasCompleteMergeSettings(settings)) {
		return [...MERGE_METHODS];
	}

	const availableMethods = MERGE_METHODS.filter((method) => {
		switch (method) {
			case "merge":
				return settings.allowMergeCommit;
			case "rebase":
				return settings.allowRebaseMerge;
			case "squash":
				return settings.allowSquashMerge;
			default:
				return false;
		}
	});
	const defaultMethod = normalizeMergeMethod(settings.viewerDefaultMergeMethod);

	if (!defaultMethod || !availableMethods.includes(defaultMethod)) {
		return availableMethods;
	}

	return [
		defaultMethod,
		...availableMethods.filter((method) => method !== defaultMethod),
	];
}
