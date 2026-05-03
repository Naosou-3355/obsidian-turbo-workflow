import { Plugin, TAbstractFile, debounce } from "obsidian";
import { DEFAULT_SETTINGS, TurboSettings, TurboSettingTab } from "./settings";
import { OfficeFilesView } from "./ui/office-files-view";
import { NativeExplorerEnhancer } from "./ui/native-explorer";
import { registerCommands } from "./commands";
import { registerCodeEmitter } from "./code-emitter";
import {
	VIEW_TYPE_OFFICE_FILES,
	RIBBON_ICON,
	REFRESH_DEBOUNCE_MS,
} from "./utils/constants";
import { PinRule } from "./types";

export default class TurboPlugin extends Plugin {
	settings!: TurboSettings;
	refreshOfficeFilesView!: () => void;
	nativeExplorer!: NativeExplorerEnhancer;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.nativeExplorer = new NativeExplorerEnhancer(this.app, this);

		this.refreshOfficeFilesView = debounce(
			() => {
				for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_OFFICE_FILES)) {
					const view = leaf.view;
					if (view instanceof OfficeFilesView) void view.refresh();
				}
			},
			REFRESH_DEBOUNCE_MS,
			true,
		);

		this.registerView(VIEW_TYPE_OFFICE_FILES, (leaf) => new OfficeFilesView(leaf, this));

		this.addRibbonIcon(RIBBON_ICON, "Toggle external files panel", () => {
			void this.toggleView();
		});

		registerCommands(this);
		this.addSettingTab(new TurboSettingTab(this.app, this));
		registerCodeEmitter(this);

		this.app.workspace.onLayoutReady(() => {
			if (this.settings.enableNativeExplorerEnhancements) {
				this.nativeExplorer.enable();
			}

			this.registerEvent(this.app.vault.on("create", () => this.refreshOfficeFilesView()));
			this.registerEvent(this.app.vault.on("delete", () => this.refreshOfficeFilesView()));
			this.registerEvent(this.app.vault.on("rename", () => this.refreshOfficeFilesView()));

			this.registerEvent(
				this.app.workspace.on("file-menu", (menu, abstractFile: TAbstractFile) => {
					if (!this.settings.enableNativeExplorerEnhancements) return;
					const path = abstractFile.path;
					const isPinned = this.settings.nativePinnedPaths.some(
						(r) => r.scope === "path" && r.pattern === path,
					);
					if (isPinned) {
						menu.addItem((item) =>
							item
								.setTitle("Unpin from top")
								.setIcon("pin-off")
								.onClick(() => {
									this.settings.nativePinnedPaths = this.settings.nativePinnedPaths.filter(
										(r) => !(r.scope === "path" && r.pattern === path),
									);
									void this.saveSettings();
									this.nativeExplorer.refresh();
								}),
						);
					} else {
						menu.addItem((item) =>
							item
								.setTitle("Pin to top")
								.setIcon("pin")
								.onClick(() => {
									const rule: PinRule = { type: "glob", scope: "path", pattern: path };
									this.settings.nativePinnedPaths.push(rule);
									void this.saveSettings();
									this.nativeExplorer.refresh();
								}),
						);
					}
				}),
			);
		});

		this.register(() => this.nativeExplorer.disable());
	}

	onunload(): void {
		// Obsidian auto-detaches views registered via registerView; do not detach here
		// or the leaf is reset to its default location on next load.
	}

	async toggleView(): Promise<void> {
		const { workspace } = this.app;
		const [existing] = workspace.getLeavesOfType(VIEW_TYPE_OFFICE_FILES);
		if (existing) {
			existing.detach();
			return;
		}
		await this.activateView();
	}

	async activateView(): Promise<void> {
		const { workspace } = this.app;
		const [existing] = workspace.getLeavesOfType(VIEW_TYPE_OFFICE_FILES);
		if (existing) {
			await workspace.revealLeaf(existing);
			return;
		}
		const leaf = this.settings.showInLeftSidebar
			? (workspace.getLeftLeaf(false) ?? workspace.getLeaf(false))
			: (workspace.getRightLeaf(false) ?? workspace.getLeaf(false));
		await leaf.setViewState({ type: VIEW_TYPE_OFFICE_FILES, active: true });
		await workspace.revealLeaf(leaf);
	}

	async movePanelToSide(): Promise<void> {
		const { workspace } = this.app;
		const [existing] = workspace.getLeavesOfType(VIEW_TYPE_OFFICE_FILES);
		if (existing) {
			existing.detach();
			await this.activateView();
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<TurboSettings> | null,
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
