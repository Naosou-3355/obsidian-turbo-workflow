import { Plugin, debounce } from "obsidian";
import { DEFAULT_SETTINGS, TurboSettings, TurboSettingTab } from "./settings";
import { OfficeFilesView } from "./ui/office-files-view";
import { registerCommands } from "./commands";
import {
	VIEW_TYPE_OFFICE_FILES,
	RIBBON_ICON,
	REFRESH_DEBOUNCE_MS,
} from "./utils/constants";

export default class TurboPlugin extends Plugin {
	settings!: TurboSettings;
	refreshOfficeFilesView!: () => void;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.refreshOfficeFilesView = debounce(
			() => {
				for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_OFFICE_FILES)) {
					const view = leaf.view;
					if (view instanceof OfficeFilesView) view.refresh();
				}
			},
			REFRESH_DEBOUNCE_MS,
			true,
		);

		this.registerView(VIEW_TYPE_OFFICE_FILES, (leaf) => new OfficeFilesView(leaf, this));

		this.addRibbonIcon(RIBBON_ICON, "Open external files panel", () => {
			void this.activateView();
		});

		registerCommands(this);

		this.addSettingTab(new TurboSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			this.registerEvent(this.app.vault.on("create", () => this.refreshOfficeFilesView()));
			this.registerEvent(this.app.vault.on("delete", () => this.refreshOfficeFilesView()));
			this.registerEvent(this.app.vault.on("rename", () => this.refreshOfficeFilesView()));
		});
	}

	onunload(): void {
		// Obsidian auto-detaches views registered via registerView; do not detach here
		// or the leaf is reset to its default location on next load.
	}

	async activateView(): Promise<void> {
		const { workspace } = this.app;
		const [existing] = workspace.getLeavesOfType(VIEW_TYPE_OFFICE_FILES);
		if (existing) {
			await workspace.revealLeaf(existing);
			return;
		}
		const leaf = workspace.getRightLeaf(false) ?? workspace.getLeaf(false);
		await leaf.setViewState({ type: VIEW_TYPE_OFFICE_FILES, active: true });
		await workspace.revealLeaf(leaf);
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
