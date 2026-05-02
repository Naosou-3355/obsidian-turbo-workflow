import TurboPlugin from "../main";
import { CMD_OPEN_PANEL, CMD_REFRESH_PANEL } from "../utils/constants";

export function registerCommands(plugin: TurboPlugin): void {
	plugin.addCommand({
		id: CMD_OPEN_PANEL,
		name: "Toggle external files panel",
		callback: () => {
			void plugin.toggleView();
		},
	});

	plugin.addCommand({
		id: CMD_REFRESH_PANEL,
		name: "Refresh external files list",
		callback: () => plugin.refreshOfficeFilesView(),
	});
}
