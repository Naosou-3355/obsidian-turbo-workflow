import { App, TFile } from "obsidian";
import { TurboSettings, SortOrder } from "../settings";
import { FolderNode, TreeNode } from "../types";

export function buildFileTree(app: App, settings: TurboSettings): FolderNode {
	const exts = new Set(settings.fileExtensions.map((e) => e.toLowerCase()));
	const allFiles = app.vault.getFiles();

	const matched: TFile[] = [];
	for (const f of allFiles) {
		if (!exts.has(f.extension.toLowerCase())) continue;
		if (!settings.showHiddenFolders && hasHiddenSegment(f.path)) continue;
		matched.push(f);
	}

	const root: FolderNode = { kind: "folder", name: "", path: "", children: [] };
	const folderIndex = new Map<string, FolderNode>();
	folderIndex.set("", root);

	for (const file of matched) {
		const parts = file.path.split("/");
		const fileName = parts.pop() as string;
		let parentPath = "";
		let parent = root;
		for (const segment of parts) {
			const nextPath = parentPath === "" ? segment : `${parentPath}/${segment}`;
			let next = folderIndex.get(nextPath);
			if (!next) {
				next = { kind: "folder", name: segment, path: nextPath, children: [] };
				folderIndex.set(nextPath, next);
				parent.children.push(next);
			}
			parent = next;
			parentPath = nextPath;
		}
		parent.children.push({ kind: "file", name: fileName, path: file.path, file });
	}

	sortTree(root, settings.sortOrder);
	return root;
}

function hasHiddenSegment(path: string): boolean {
	for (const segment of path.split("/")) {
		if (segment.startsWith(".")) return true;
	}
	return false;
}

function sortTree(node: FolderNode, order: SortOrder): void {
	node.children.sort((a, b) => compareNodes(a, b, order));
	for (const child of node.children) {
		if (child.kind === "folder") sortTree(child, order);
	}
}

function compareNodes(a: TreeNode, b: TreeNode, order: SortOrder): number {
	if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
	if (a.kind === "file" && b.kind === "file") {
		if (order === "ext-asc") {
			const extCmp = a.file.extension.localeCompare(b.file.extension);
			if (extCmp !== 0) return extCmp;
		}
	}
	const dir = order === "name-desc" ? -1 : 1;
	return a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) * dir;
}
