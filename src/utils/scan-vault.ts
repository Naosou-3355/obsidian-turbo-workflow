import { App, FileSystemAdapter, TFile } from "obsidian";
import { TurboSettings, SortOrder } from "../settings";
import { FileNode, FolderNode, HideRule, PinRule, TreeNode } from "../types";
import { matchesPattern } from "./pattern-match";

export async function buildFileTree(app: App, settings: TurboSettings): Promise<FolderNode> {
	const exts = new Set(settings.fileExtensions.map((e) => e.toLowerCase()));
	let fileNodes: FileNode[];

	if (!settings.showHiddenFolders) {
		fileNodes = buildFromVaultIndex(app, exts);
	} else {
		fileNodes = await buildFromFilesystem(app, exts);
	}

	// Apply file hide patterns
	fileNodes = fileNodes.filter((node) => !isHidden(node.name, node.path, settings.hidePatterns));

	// Mark pinned files
	for (const node of fileNodes) {
		node.pinned = isPinned(node.name, node.path, settings.pinnedPaths);
	}

	const root = assembleTree(fileNodes, settings);
	console.debug(
		`[turbo-workflow] ${fileNodes.length} matched file(s)` +
			` (extensions: ${[...exts].join(", ")}, showHidden: ${settings.showHiddenFolders})`,
	);
	return root;
}

function buildFromVaultIndex(app: App, exts: Set<string>): FileNode[] {
	const nodes: FileNode[] = [];
	for (const f of app.vault.getFiles()) {
		if (!exts.has(f.extension.toLowerCase())) continue;
		if (hasHiddenSegment(f.path)) continue;
		nodes.push({ kind: "file", name: f.name, path: f.path, file: f });
	}
	return nodes;
}

async function buildFromFilesystem(app: App, exts: Set<string>): Promise<FileNode[]> {
	const adapter = app.vault.adapter;
	if (!(adapter instanceof FileSystemAdapter)) {
		return buildFromVaultIndex(app, exts);
	}
	const queue: string[] = [""];
	const visited = new Set<string>([""]); // guard against symlink cycles
	const allPaths: string[] = [];
	while (queue.length > 0) {
		const dir = queue.shift()!;
		const listed = await adapter.list(dir);
		for (const f of listed.files) {
			allPaths.push(f);
		}
		for (const folder of listed.folders) {
			if (!visited.has(folder)) {
				visited.add(folder);
				queue.push(folder);
			}
		}
	}
	const nodes: FileNode[] = [];
	for (const p of allPaths) {
		const lastDot = p.lastIndexOf(".");
		const ext = lastDot >= 0 ? p.slice(lastDot + 1).toLowerCase() : "";
		if (!exts.has(ext)) continue;
		const lastSlash = p.lastIndexOf("/");
		const name = lastSlash >= 0 ? p.slice(lastSlash + 1) : p;
		const abstract = app.vault.getAbstractFileByPath(p);
		nodes.push({
			kind: "file",
			name,
			path: p,
			file: abstract instanceof TFile ? abstract : null,
			absPath: adapter.getFullPath(p),
		});
	}
	return nodes;
}

function hasHiddenSegment(path: string): boolean {
	for (const segment of path.split("/")) {
		if (segment.startsWith(".")) return true;
	}
	return false;
}

function isHidden(name: string, path: string, rules: HideRule[]): boolean {
	return rules.some((rule) => matchesPattern(rule, name, path));
}

function isPinned(name: string, path: string, rules: PinRule[]): boolean {
	return rules.some((rule) => matchesPattern(rule, name, path));
}

function assembleTree(nodes: FileNode[], settings: TurboSettings): FolderNode {
	const root: FolderNode = { kind: "folder", name: "", path: "", children: [] };
	const folderIndex = new Map<string, FolderNode>();
	folderIndex.set("", root);

	for (const node of nodes) {
		const parts = node.path.split("/");
		parts.pop(); // remove filename
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
		parent.children.push(node);
	}

	pruneHiddenFolders(root, settings.hidePatterns);
	markPinnedFolders(root, settings.pinnedPaths);
	sortTree(root, settings.sortOrder);
	return root;
}

function pruneHiddenFolders(node: FolderNode, rules: HideRule[]): void {
	node.children = node.children.filter((child) => {
		if (child.kind === "folder") {
			if (isHidden(child.name, child.path, rules)) return false;
			pruneHiddenFolders(child, rules);
		}
		return true;
	});
}

function markPinnedFolders(node: FolderNode, rules: PinRule[]): void {
	for (const child of node.children) {
		if (child.kind === "folder") {
			child.pinned = isPinned(child.name, child.path, rules);
			markPinnedFolders(child, rules);
		}
	}
}

function sortTree(node: FolderNode, order: SortOrder): void {
	node.children.sort((a, b) => compareNodes(a, b, order));
	for (const child of node.children) {
		if (child.kind === "folder") sortTree(child, order);
	}
}

function compareNodes(a: TreeNode, b: TreeNode, order: SortOrder): number {
	if (a.pinned && !b.pinned) return -1;
	if (!a.pinned && b.pinned) return 1;
	if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
	if (a.kind === "file" && b.kind === "file" && order === "ext-asc") {
		const extA = a.name.split(".").pop() ?? "";
		const extB = b.name.split(".").pop() ?? "";
		const extCmp = extA.localeCompare(extB);
		if (extCmp !== 0) return extCmp;
	}
	const dir = order === "name-desc" ? -1 : 1;
	return a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) * dir;
}
