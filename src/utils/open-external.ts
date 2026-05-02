import { App, FileSystemAdapter, Notice, Platform, TFile } from "obsidian";
import { shell } from "electron";

export async function openExternal(app: App, file: TFile): Promise<void> {
	if (!Platform.isDesktop) {
		new Notice("Opening external files is only available on desktop.");
		return;
	}
	const adapter = app.vault.adapter;
	if (!(adapter instanceof FileSystemAdapter)) {
		new Notice("This vault adapter does not expose filesystem paths.");
		return;
	}
	const absPath = adapter.getFullPath(file.path);
	try {
		const errMsg = await shell.openPath(absPath);
		if (errMsg) {
			new Notice(`Could not open file: ${errMsg}`);
		}
	} catch (err) {
		console.error("[turbo-workflow] openExternal failed", err);
		new Notice("Could not open file. See console for details.");
	}
}
