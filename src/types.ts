import { TFile } from "obsidian";

export interface FolderNode {
	kind: "folder";
	name: string;
	path: string;
	children: TreeNode[];
	pinned?: boolean;
}

export interface FileNode {
	kind: "file";
	name: string;
	path: string;
	file: TFile | null; // null when not in vault index (hidden folder files)
	absPath?: string;   // set when file is not in vault index
	pinned?: boolean;
}

export type TreeNode = FolderNode | FileNode;

export interface HideRule {
	type: "glob" | "regex";
	pattern: string;
	scope: "name" | "path";
}

export interface PinRule {
	type: "glob" | "regex";
	pattern: string;
	scope: "name" | "path";
}
