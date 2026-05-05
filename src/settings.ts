import { App, PluginSettingTab, Setting } from "obsidian";
import TurboPlugin from "./main";
import { HideRule, PinRule } from "./types";
import { DEFAULT_EXTENSIONS, MAX_EXTENSIONS } from "./utils/constants";

export type SortOrder = "name-asc" | "name-desc" | "ext-asc";
export type CollapseMode = "manual" | "cascade" | "accordion";

export interface TurboSettings {
	// Core panel settings
	fileExtensions: string[];
	sortOrder: SortOrder;
	openOnSingleClick: boolean;
	showInLeftSidebar: boolean;
	// Filter / pin (custom panel)
	hidePatterns: HideRule[];
	pinnedPaths: PinRule[];
	// Collapse mode (custom panel)
	collapseMode: CollapseMode;
	// Code emitter
	codeEmitterEnabled: boolean;
	codeEmitterRemoteEnabled: boolean;
}

export const DEFAULT_SETTINGS: TurboSettings = {
	fileExtensions: [...DEFAULT_EXTENSIONS],
	sortOrder: "name-asc",
	openOnSingleClick: false,
	showInLeftSidebar: false,
	hidePatterns: [],
	pinnedPaths: [],
	collapseMode: "manual",
	codeEmitterEnabled: false,
	codeEmitterRemoteEnabled: false,
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

export function parsePatternRules(raw: string): HideRule[] {
	const rules: HideRule[] = [];
	for (const line of raw.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		let rest = trimmed;
		let type: "glob" | "regex" = "glob";
		let scope: "name" | "path" = "name";
		if (rest.startsWith("regex:")) { type = "regex"; rest = rest.slice(6); }
		if (rest.startsWith("path:")) { scope = "path"; rest = rest.slice(5); }
		const pattern = rest.trim();
		if (pattern) rules.push({ type, scope, pattern });
	}
	return rules;
}

export function serializePatternRules(rules: HideRule[] | PinRule[]): string {
	return rules.map((r) => {
		const typePrefix = r.type === "regex" ? "regex:" : "";
		const scopePrefix = r.scope === "path" ? "path:" : "";
		return `${typePrefix}${scopePrefix}${r.pattern}`;
	}).join("\n");
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
		this.renderPanelSection(containerEl);
		this.renderPanelFilterSection(containerEl);
		this.renderCodeEmitterSection(containerEl);
	}

	// ──────────────────────────────────────────────────────────────
	// 1. External files panel — what to show, where, how
	// ──────────────────────────────────────────────────────────────
	private renderPanelSection(el: HTMLElement): void {
		new Setting(el).setName("External files panel").setHeading();

		new Setting(el)
			.setName("File extensions")
			.setDesc(
				"Comma- or space-separated list of extensions to show in the panel. Leading dots are optional.",
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

		new Setting(el)
			.setName("Reset extensions")
			.setDesc("Restore the default extension list.")
			.addButton((btn) =>
				btn.setButtonText("Reset").onClick(async () => {
					this.plugin.settings.fileExtensions = [...DEFAULT_EXTENSIONS];
					await this.plugin.saveSettings();
					this.plugin.refreshOfficeFilesView();
					this.display();
				}),
			);

		new Setting(el)
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

		new Setting(el)
			.setName("Collapse mode")
			.setDesc(
				"Manual: each folder toggles independently. Cascade: opening a folder collapses its siblings. Accordion: only one top-level folder open at a time.",
			)
			.addDropdown((drop) =>
				drop
					.addOption("manual", "Manual")
					.addOption("cascade", "Cascade")
					.addOption("accordion", "Accordion")
					.setValue(this.plugin.settings.collapseMode)
					.onChange(async (value) => {
						this.plugin.settings.collapseMode = value as CollapseMode;
						await this.plugin.saveSettings();
						this.plugin.refreshOfficeFilesView();
					}),
			);

		new Setting(el)
			.setName("Open file on single click")
			.setDesc(
				"If on, a single click opens the file in its external app. Otherwise a double click is required.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.openOnSingleClick)
					.onChange(async (value) => {
						this.plugin.settings.openOnSingleClick = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(el)
			.setName("Show panel in left sidebar")
			.setDesc(
				"Show the panel in the left sidebar instead of the right. Moves immediately.",
			)
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

	// ──────────────────────────────────────────────────────────────
	// 2. Filter and pin rules for the panel
	// ──────────────────────────────────────────────────────────────
	private renderPanelFilterSection(el: HTMLElement): void {
		new Setting(el).setName("Panel filter and pin rules").setHeading();

		const patternHelp =
			"One rule per line. Default is glob against the file/folder name. Prefix with regex: for regex, or path: to match the full vault path. Example: *.json or regex:^\\. or path:*.docx";

		new Setting(el)
			.setName("Hide patterns")
			.setDesc(patternHelp)
			.addTextArea((text) => {
				text
					.setPlaceholder(`*.json\npath:${this.app.vault.configDir}/*`)
					.setValue(serializePatternRules(this.plugin.settings.hidePatterns))
					.onChange(async (value) => {
						this.plugin.settings.hidePatterns = parsePatternRules(value);
						await this.plugin.saveSettings();
						this.plugin.refreshOfficeFilesView();
					});
				text.inputEl.rows = 4;
				text.inputEl.cols = 40;
			});

		new Setting(el)
			.setName("Pin patterns")
			.setDesc(
				"Matching items appear at the top. Same format as hide patterns. Right-click a file in the panel to pin it directly.",
			)
			.addTextArea((text) => {
				text
					.setPlaceholder("Annual*\npath:projects/active/*")
					.setValue(serializePatternRules(this.plugin.settings.pinnedPaths))
					.onChange(async (value) => {
						this.plugin.settings.pinnedPaths = parsePatternRules(value) as PinRule[];
						await this.plugin.saveSettings();
						this.plugin.refreshOfficeFilesView();
					});
				text.inputEl.rows = 4;
				text.inputEl.cols = 40;
			});
	}

	// ──────────────────────────────────────────────────────────────
	// 3. Code emitter — run code blocks inline
	// ──────────────────────────────────────────────────────────────
	private renderCodeEmitterSection(el: HTMLElement): void {
		new Setting(el).setName("Code emitter").setHeading();

		new Setting(el)
			.setName("Enable code emitter")
			.setDesc(
				"Add a run button to code blocks in notes. Python blocks download a runtime on first use (requires internet).",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.codeEmitterEnabled)
					.onChange(async (value) => {
						this.plugin.settings.codeEmitterEnabled = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(el)
			.setName("Enable remote execution")
			.setDesc(
				"Allow sending code to external servers for execution. Your code is transmitted to a third-party service.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.codeEmitterRemoteEnabled)
					.onChange(async (value) => {
						this.plugin.settings.codeEmitterRemoteEnabled = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
