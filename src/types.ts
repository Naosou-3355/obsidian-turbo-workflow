import { TFile } from "obsidian";

export interface FolderNode {
	kind: "folder";
	name: string;
	path: string;
	children: TreeNode[];
}

export interface FileNode {
	kind: "file";
	name: string;
	path: string;
	file: TFile;
}

export type TreeNode = FolderNode | FileNode;
