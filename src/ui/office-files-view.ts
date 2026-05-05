import { ItemView, Menu, WorkspaceLeaf } from "obsidian";
import TurboPlugin from "../main";
import { VIEW_TYPE_OFFICE_FILES, RIBBON_ICON } from "../utils/constants";
import { buildFileTree } from "../utils/scan-vault";
import { openExternal } from "../utils/open-external";
import { renderTree, TreeHandlers } from "./tree-renderer";
import { applyCascadeCollapse, applyAccordion } from "../utils/tree-helpers";
import { FileNode, FolderNode, PinRule } from "../types";

export class OfficeFilesView extends ItemView {
	private plugin: TurboPlugin;
	private rootEl!: HTMLElement;
	private selectedPath: string | null = null;
	private toggled = new Map<string, boolean>(); // path → collapsed?
	private refreshGen = 0;
	private lastTree: FolderNode | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: TurboPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_OFFICE_FILES;
	}

	getDisplayText(): string {
		return "Nao's turbo workflow";
	}

	getIcon(): string {
		return RIBBON_ICON;
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.rootEl = this.contentEl.createDiv({ cls: "turbo-office-view" });
		void this.refresh();
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	async refresh(): Promise<void> {
		if (!this.rootEl) return;
		const gen = ++this.refreshGen;
		let tree: FolderNode;
		try {
			tree = await buildFileTree(this.app, this.plugin.settings);
		} catch (err) {
			console.error("[turbo-workflow] buildFileTree failed", err);
			if (gen === this.refreshGen) {
				this.rootEl.empty();
				this.rootEl.createDiv({
					cls: "turbo-empty",
					text: "Error loading files. See console for details.",
				});
			}
			return;
		}
		if (gen !== this.refreshGen) return; // stale render

		this.lastTree = tree;
		const topLevelFolderPaths = tree.children
			.filter((c) => c.kind === "folder")
			.map((c) => c.path);

		const handlers: TreeHandlers = {
			onFileClick: (node: FileNode, row: HTMLElement) => {
				this.setSelection(node.path, row);
				if (this.plugin.settings.openOnSingleClick) {
					void openExternal(this.app, node);
				}
			},
			onFileDoubleClick: (node: FileNode) => {
				void openExternal(this.app, node);
			},
			onFolderToggle: (path: string, siblingPaths: string[]) => {
				const current = this.isFolderCollapsed(path);
				const nowCollapsed = !current;
				this.toggled.set(path, nowCollapsed);
				const mode = this.plugin.settings.collapseMode;
				if (mode === "cascade") {
					applyCascadeCollapse(this.toggled, path, siblingPaths, nowCollapsed);
				} else if (mode === "accordion") {
					applyAccordion(this.toggled, path, topLevelFolderPaths, nowCollapsed);
				}
				void this.refresh();
			},
			onFileContextMenu: (node: FileNode, evt: MouseEvent) => {
				this.showFileContextMenu(node, evt);
			},
			isCollapsed: (path: string) => this.isFolderCollapsed(path),
			isSelected: (path: string) => path === this.selectedPath,
		};

		renderTree(
			this.rootEl,
			tree,
			handlers,
			{
				totalFiles: this.app.vault.getFiles().length,
				extensions: this.plugin.settings.fileExtensions,
			},
		);
	}

	private isFolderCollapsed(path: string): boolean {
		return this.toggled.get(path) ?? false;
	}

	private setSelection(path: string, row: HTMLElement): void {
		this.selectedPath = path;
		this.rootEl.querySelectorAll(".turbo-file.is-active").forEach((el) =>
			el.removeClass("is-active"),
		);
		row.addClass("is-active");
	}

	private showFileContextMenu(node: FileNode, evt: MouseEvent): void {
		const menu = new Menu();
		const path = node.path;
		const isPinned = this.plugin.settings.pinnedPaths.some(
			(r) => r.scope === "path" && r.pattern === path,
		);
		if (isPinned) {
			menu.addItem((item) =>
				item
					.setTitle("Unpin from top")
					.setIcon("pin-off")
					.onClick(() => this.unpinItem(path)),
			);
		} else {
			menu.addItem((item) =>
				item
					.setTitle("Pin to top")
					.setIcon("pin")
					.onClick(() => this.pinItem(path)),
			);
		}
		menu.showAtMouseEvent(evt);
	}

	private pinItem(path: string): void {
		const alreadyPinned = this.plugin.settings.pinnedPaths.some(
			(r) => r.scope === "path" && r.pattern === path,
		);
		if (alreadyPinned) return;
		const rule: PinRule = { type: "glob", scope: "path", pattern: path };
		this.plugin.settings.pinnedPaths.push(rule);
		void this.plugin.saveSettings();
		void this.refresh();
	}

	private unpinItem(path: string): void {
		this.plugin.settings.pinnedPaths = this.plugin.settings.pinnedPaths.filter(
			(r) => !(r.scope === "path" && r.pattern === path),
		);
		void this.plugin.saveSettings();
		void this.refresh();
	}
}
