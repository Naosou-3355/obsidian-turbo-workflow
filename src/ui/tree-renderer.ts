import { setIcon } from "obsidian";
import { FileNode, FolderNode, TreeNode } from "../types";

export interface TreeHandlers {
	onFileClick(node: FileNode, row: HTMLElement): void;
	onFileDoubleClick(node: FileNode): void;
	onFolderToggle(path: string, siblingPaths: string[]): void;
	onFileContextMenu?(node: FileNode, evt: MouseEvent): void;
	isCollapsed(path: string): boolean;
	isSelected(path: string): boolean;
}

export function renderTree(
	container: HTMLElement,
	root: FolderNode,
	handlers: TreeHandlers,
	diagnostics: { totalFiles: number; extensions: string[] },
): void {
	container.empty();
	if (root.children.length === 0) {
		const wrap = container.createDiv({ cls: "turbo-empty" });
		wrap.createDiv({ text: "No matching files found in vault." });
		wrap.createDiv({
			cls: "turbo-empty-hint",
			text: `Vault: ${diagnostics.totalFiles} file(s) total. Looking for: ${diagnostics.extensions.join(", ") || "(none configured)"}`,
		});
		wrap.createDiv({
			cls: "turbo-empty-hint",
			text: "Add matching files to your vault, or adjust the extension list in plugin settings.",
		});
		return;
	}

	const siblingFolderPaths = root.children
		.filter((c) => c.kind === "folder")
		.map((c) => c.path);

	for (const child of root.children) {
		renderNode(container, child, siblingFolderPaths, handlers);
	}
}

function renderNode(
	parent: HTMLElement,
	node: TreeNode,
	siblingFolderPaths: string[],
	handlers: TreeHandlers,
): void {
	if (node.kind === "folder") {
		renderFolder(parent, node, siblingFolderPaths, handlers);
	} else {
		renderFile(parent, node, handlers);
	}
}

function renderFolder(
	parent: HTMLElement,
	folder: FolderNode,
	siblingFolderPaths: string[],
	handlers: TreeHandlers,
): void {
	const collapsed = handlers.isCollapsed(folder.path);

	const row = parent.createDiv({ cls: "turbo-folder" });
	if (folder.pinned) row.addClass("turbo-pinned");
	const chevron = row.createSpan({ cls: "turbo-folder-chevron" });
	setIcon(chevron, collapsed ? "chevron-right" : "chevron-down");
	const iconEl = row.createSpan({ cls: "turbo-folder-icon" });
	setIcon(iconEl, "folder");
	if (folder.pinned) {
		const pinEl = row.createSpan({ cls: "turbo-pin-indicator" });
		setIcon(pinEl, "pin");
	}
	row.createSpan({ cls: "turbo-folder-name", text: folder.name });

	const childrenEl = parent.createDiv({ cls: "turbo-children" });
	if (collapsed) childrenEl.addClass("is-collapsed");

	row.addEventListener("click", () => {
		handlers.onFolderToggle(folder.path, siblingFolderPaths);
		const nowCollapsed = handlers.isCollapsed(folder.path);
		setIcon(chevron, nowCollapsed ? "chevron-right" : "chevron-down");
		childrenEl.toggleClass("is-collapsed", nowCollapsed);
	});

	const childSiblingPaths = folder.children
		.filter((c) => c.kind === "folder")
		.map((c) => c.path);

	for (const child of folder.children) {
		renderNode(childrenEl, child, childSiblingPaths, handlers);
	}
}

function renderFile(
	parent: HTMLElement,
	node: FileNode,
	handlers: TreeHandlers,
): void {
	const row = parent.createDiv({ cls: "turbo-file" });
	if (handlers.isSelected(node.path)) row.addClass("is-active");
	if (node.pinned) row.addClass("turbo-pinned");

	const iconEl = row.createSpan({ cls: "turbo-file-icon" });
	const lastDot = node.name.lastIndexOf(".");
	const ext = lastDot >= 0 ? node.name.slice(lastDot + 1).toLowerCase() : "";
	setIcon(iconEl, iconForExtension(ext));

	if (node.pinned) {
		const pinEl = row.createSpan({ cls: "turbo-pin-indicator" });
		setIcon(pinEl, "pin");
	}
	row.createSpan({ cls: "turbo-file-name", text: node.name });

	row.addEventListener("click", () => handlers.onFileClick(node, row));
	row.addEventListener("dblclick", () => handlers.onFileDoubleClick(node));
	if (handlers.onFileContextMenu) {
		row.addEventListener("contextmenu", (evt) => handlers.onFileContextMenu!(node, evt));
	}
}

function iconForExtension(ext: string): string {
	switch (ext) {
		case "xlsx":
		case "xls":
		case "csv":
			return "file-spreadsheet";
		case "docx":
		case "doc":
		case "rtf":
			return "file-text";
		case "pptx":
		case "ppt":
			return "file-image";
		case "pdf":
			return "file-text";
		default:
			return "file";
	}
}
