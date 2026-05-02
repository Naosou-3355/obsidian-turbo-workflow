import { TFile, setIcon } from "obsidian";
import { FolderNode, TreeNode } from "../types";

export interface TreeHandlers {
	onFileClick(file: TFile, row: HTMLElement, evt: MouseEvent): void;
	onFileDoubleClick(file: TFile): void;
	onFolderToggle(path: string): void;
	isCollapsed(path: string): boolean;
	isSelected(path: string): boolean;
}

export function renderTree(container: HTMLElement, root: FolderNode, handlers: TreeHandlers): void {
	container.empty();
	if (root.children.length === 0) {
		container.createDiv({
			cls: "turbo-empty",
			text: "No matching files. Configure extensions in plugin settings.",
		});
		return;
	}
	for (const child of root.children) {
		renderNode(container, child, handlers);
	}
}

function renderNode(parent: HTMLElement, node: TreeNode, handlers: TreeHandlers): void {
	if (node.kind === "folder") {
		renderFolder(parent, node, handlers);
	} else {
		renderFile(parent, node.file, handlers);
	}
}

function renderFolder(parent: HTMLElement, folder: FolderNode, handlers: TreeHandlers): void {
	const collapsed = handlers.isCollapsed(folder.path);

	const row = parent.createDiv({ cls: "turbo-folder" });
	const chevron = row.createSpan({ cls: "turbo-folder-chevron" });
	setIcon(chevron, collapsed ? "chevron-right" : "chevron-down");
	const iconEl = row.createSpan({ cls: "turbo-folder-icon" });
	setIcon(iconEl, "folder");
	row.createSpan({ cls: "turbo-folder-name", text: folder.name });

	const childrenEl = parent.createDiv({ cls: "turbo-children" });
	if (collapsed) childrenEl.addClass("is-collapsed");

	row.addEventListener("click", () => {
		handlers.onFolderToggle(folder.path);
		const nowCollapsed = handlers.isCollapsed(folder.path);
		setIcon(chevron, nowCollapsed ? "chevron-right" : "chevron-down");
		childrenEl.toggleClass("is-collapsed", nowCollapsed);
	});

	for (const child of folder.children) {
		renderNode(childrenEl, child, handlers);
	}
}

function renderFile(parent: HTMLElement, file: TFile, handlers: TreeHandlers): void {
	const row = parent.createDiv({ cls: "turbo-file" });
	if (handlers.isSelected(file.path)) row.addClass("is-active");

	const iconEl = row.createSpan({ cls: "turbo-file-icon" });
	setIcon(iconEl, iconForExtension(file.extension));
	row.createSpan({ cls: "turbo-file-name", text: file.name });

	row.addEventListener("click", (evt) => handlers.onFileClick(file, row, evt));
	row.addEventListener("dblclick", () => handlers.onFileDoubleClick(file));
}

function iconForExtension(ext: string): string {
	switch (ext.toLowerCase()) {
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
