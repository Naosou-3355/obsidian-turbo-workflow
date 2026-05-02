import { ItemView, WorkspaceLeaf } from "obsidian";
import TurboPlugin from "../main";
import { VIEW_TYPE_OFFICE_FILES, RIBBON_ICON } from "../utils/constants";
import { buildFileTree } from "../utils/scan-vault";
import { openExternal } from "../utils/open-external";
import { renderTree, TreeHandlers } from "./tree-renderer";

export class OfficeFilesView extends ItemView {
	private plugin: TurboPlugin;
	private rootEl!: HTMLElement;
	private selectedPath: string | null = null;
	private toggled = new Map<string, boolean>(); // path → collapsed?

	constructor(leaf: WorkspaceLeaf, plugin: TurboPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_OFFICE_FILES;
	}

	getDisplayText(): string {
		return "Office files";
	}

	getIcon(): string {
		return RIBBON_ICON;
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.rootEl = this.contentEl.createDiv({ cls: "turbo-office-view" });
		this.refresh();
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	refresh(): void {
		if (!this.rootEl) return;
		const tree = buildFileTree(this.app, this.plugin.settings);
		const handlers: TreeHandlers = {
			onFileClick: (file, row) => {
				this.setSelection(file.path, row);
				if (this.plugin.settings.openOnSingleClick) {
					void openExternal(this.app, file);
				}
			},
			onFileDoubleClick: (file) => {
				void openExternal(this.app, file);
			},
			onFolderToggle: (path) => {
				const current = this.isFolderCollapsed(path);
				this.toggled.set(path, !current);
			},
			isCollapsed: (path) => this.isFolderCollapsed(path),
			isSelected: (path) => path === this.selectedPath,
		};
		renderTree(this.rootEl, tree, handlers);
	}

	private isFolderCollapsed(path: string): boolean {
		const explicit = this.toggled.get(path);
		if (explicit !== undefined) return explicit;
		return !this.plugin.settings.expandFoldersByDefault;
	}

	private setSelection(path: string, row: HTMLElement): void {
		this.selectedPath = path;
		const previous = this.rootEl.querySelectorAll(".turbo-file.is-active");
		previous.forEach((el) => el.removeClass("is-active"));
		row.addClass("is-active");
	}
}
