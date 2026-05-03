export function applyCascadeCollapse(
	toggled: Map<string, boolean>,
	clickedPath: string,
	siblings: string[],
	nowCollapsed: boolean,
): void {
	if (nowCollapsed) return;
	for (const sib of siblings) {
		if (sib !== clickedPath) toggled.set(sib, true);
	}
}

export function applyAccordion(
	toggled: Map<string, boolean>,
	clickedPath: string,
	topLevelFolders: string[],
	nowCollapsed: boolean,
): void {
	if (nowCollapsed) return;
	for (const folder of topLevelFolders) {
		if (folder !== clickedPath) toggled.set(folder, true);
	}
}
