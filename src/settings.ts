import { App, PluginSettingTab, Setting } from "obsidian";
import TurboPlugin from "./main";
import { DEFAULT_EXTENSIONS, MAX_EXTENSIONS } from "./utils/constants";

export type SortOrder = "name-asc" | "name-desc" | "ext-asc";

export interface TurboSettings {
	fileExtensions: string[];
	showHiddenFolders: boolean;
	sortOrder: SortOrder;
	openOnSingleClick: boolean;
	expandFoldersByDefault: boolean;
	showInLeftSidebar: boolean;
}

export const DEFAULT_SETTINGS: TurboSettings = {
	fileExtensions: [...DEFAULT_EXTENSIONS],
	showHiddenFolders: false,
	sortOrder: "name-asc",
	openOnSingleClick: false,
	expandFoldersByDefault: true,
	showInLeftSidebar: false,
};

export function normalizeExtensionsInput(raw: string): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const piece of raw.split(/[,\s]+/)) {
		const trimmed = piece.trim().replace(/^\.+/, "").toLowerCase();
		if (!trimmed) continue;
		if (!/^[a-z0-9_-]+$/.test(trimmed)) continue;
		if (seen.has(trimmed)) continue;
		seen.add(trimmed);
		out.push(trimmed);
		if (out.length >= MAX_EXTENSIONS) break;
	}
	return out;
}

export class TurboSettingTab extends PluginSettingTab {
	plugin: TurboPlugin;

	constructor(app: App, plugin: TurboPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("File extensions")
			.setDesc(
				"Comma- or space-separated list of extensions to show in the panel. Leading dots are optional. Letters, digits, hyphens and underscores only.",
			)
			.addTextArea((text) => {
				text
					.setPlaceholder("Docx, xlsx, pptx")
					.setValue(this.plugin.settings.fileExtensions.join(", "))
					.onChange(async (value) => {
						this.plugin.settings.fileExtensions = normalizeExtensionsInput(value);
						await this.plugin.saveSettings();
						this.plugin.refreshOfficeFilesView();
					});
				text.inputEl.rows = 3;
				text.inputEl.cols = 40;
			});

		new Setting(containerEl)
			.setName("Reset to defaults")
			.setDesc("Restore the default extension list.")
			.addButton((btn) =>
				btn
					.setButtonText("Reset")
					.onClick(async () => {
						this.plugin.settings.fileExtensions = [...DEFAULT_EXTENSIONS];
						await this.plugin.saveSettings();
						this.plugin.refreshOfficeFilesView();
						this.display();
					}),
			);

		const configDir = this.app.vault.configDir;
		new Setting(containerEl)
			.setName("Show hidden folders")
			.setDesc(
				`Include folders starting with a dot, such as ${configDir}. Off by default.`,
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showHiddenFolders)
					.onChange(async (value) => {
						this.plugin.settings.showHiddenFolders = value;
						await this.plugin.saveSettings();
						this.plugin.refreshOfficeFilesView();
					}),
			);

		new Setting(containerEl)
			.setName("Sort order")
			.setDesc("How to sort files within each folder.")
			.addDropdown((drop) =>
				drop
					.addOption("name-asc", "Name ascending")
					.addOption("name-desc", "Name descending")
					.addOption("ext-asc", "Extension, then name")
					.setValue(this.plugin.settings.sortOrder)
					.onChange(async (value) => {
						this.plugin.settings.sortOrder = value as SortOrder;
						await this.plugin.saveSettings();
						this.plugin.refreshOfficeFilesView();
					}),
			);

		new Setting(containerEl)
			.setName("Expand folders by default")
			.setDesc("When the panel opens, expand all folders.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.expandFoldersByDefault)
					.onChange(async (value) => {
						this.plugin.settings.expandFoldersByDefault = value;
						await this.plugin.saveSettings();
						this.plugin.refreshOfficeFilesView();
					}),
			);

		new Setting(containerEl)
			.setName("Open file on single click")
			.setDesc("If on, a single click opens the file in its external app. Otherwise a double click is required.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.openOnSingleClick)
					.onChange(async (value) => {
						this.plugin.settings.openOnSingleClick = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Show panel in left sidebar")
			.setDesc("Show the external files panel in the left sidebar (next to the file explorer) instead of the right sidebar. The panel will move immediately.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showInLeftSidebar)
					.onChange(async (value) => {
						this.plugin.settings.showInLeftSidebar = value;
						await this.plugin.saveSettings();
						await this.plugin.movePanelToSide();
					}),
			);
	}
}
