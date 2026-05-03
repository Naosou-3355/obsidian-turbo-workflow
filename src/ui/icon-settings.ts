import { setIcon } from "obsidian";
import TurboPlugin from "../main";

export function renderIconSettings(containerEl: HTMLElement, plugin: TurboPlugin): void {
	const exts = plugin.settings.fileExtensions;
	if (exts.length === 0) {
		containerEl.createEl("p", {
			text: "No extensions configured. Add extensions in the panel settings above.",
			cls: "setting-item-description",
		});
		return;
	}

	const table = containerEl.createEl("table", { cls: "turbo-icon-table" });
	const thead = table.createEl("thead");
	const headerRow = thead.createEl("tr");
	headerRow.createEl("th", { text: "Extension" });
	headerRow.createEl("th", { text: "Icon name" });
	headerRow.createEl("th", { text: "Preview" });

	const tbody = table.createEl("tbody");

	for (const ext of exts) {
		const row = tbody.createEl("tr");
		row.createEl("td", { text: ext });

		const inputCell = row.createEl("td");
		const input = inputCell.createEl("input", { cls: "turbo-icon-input" });
		input.type = "text";
		input.placeholder = "Example: file-spreadsheet";
		input.value = plugin.settings.extensionIcons[ext] ?? "";

		const previewCell = row.createEl("td");
		const previewEl = previewCell.createSpan({ cls: "turbo-icon-preview" });

		const updatePreview = (): void => {
			previewEl.empty();
			const iconName = input.value.trim();
			if (iconName) {
				try {
					setIcon(previewEl, iconName);
				} catch {
					previewEl.textContent = "?";
				}
			}
		};
		updatePreview();

		input.addEventListener("input", updatePreview);
		input.addEventListener("change", () => {
			const iconName = input.value.trim();
			if (iconName) {
				plugin.settings.extensionIcons[ext] = iconName;
			} else {
				delete plugin.settings.extensionIcons[ext];
			}
			void plugin.saveSettings();
			plugin.refreshOfficeFilesView();
		});
	}
}
