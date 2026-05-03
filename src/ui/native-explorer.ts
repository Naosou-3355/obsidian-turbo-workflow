import { App } from "obsidian";
import TurboPlugin from "../main";
import { matchesPattern } from "../utils/pattern-match";

interface FileExplorerView {
	containerEl: HTMLElement | undefined;
}

export class NativeExplorerEnhancer {
	private observer: MutationObserver | null = null;
	private container: HTMLElement | null = null;

	constructor(private app: App, private plugin: TurboPlugin) {}

	enable(): void {
		const leaves = this.app.workspace.getLeavesOfType("file-explorer");
		const leaf = leaves[0];
		if (!leaf) return;
		const view = leaf.view as unknown as FileExplorerView;
		if (!view.containerEl) return;
		this.container = view.containerEl;
		this.applyRules();
		this.observer = new MutationObserver(() => this.applyRules());
		this.observer.observe(this.container, { childList: true, subtree: true });
	}

	disable(): void {
		this.observer?.disconnect();
		this.observer = null;
		if (this.container) {
			this.container.querySelectorAll(".turbo-hidden").forEach((el) =>
				el.removeClass("turbo-hidden"),
			);
			this.container.querySelectorAll(".turbo-native-pinned").forEach((el) =>
				el.removeClass("turbo-native-pinned"),
			);
		}
		this.container = null;
	}

	refresh(): void {
		if (this.container) this.applyRules();
	}

	private applyRules(): void {
		if (!this.container || !this.observer) return;
		// Disconnect before modifying DOM so our own class changes don't re-fire the observer
		this.observer.disconnect();
		try {
			this.doApplyRules();
		} finally {
			if (this.container) {
				this.observer.observe(this.container, { childList: true, subtree: true });
			}
		}
	}

	private doApplyRules(): void {
		if (!this.container) return;
		const { nativeHidePatterns, nativePinnedPaths } = this.plugin.settings;

		this.container.querySelectorAll<HTMLElement>(".nav-file").forEach((el) => {
			const titleEl = el.querySelector<HTMLElement>(".nav-file-title");
			const path = titleEl?.dataset["path"] ?? "";
			const lastSlash = path.lastIndexOf("/");
			const name = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
			const shouldHide = nativeHidePatterns.some((rule) => matchesPattern(rule, name, path));
			el.toggleClass("turbo-hidden", shouldHide);
			const pinned = nativePinnedPaths.some((rule) => matchesPattern(rule, name, path));
			el.toggleClass("turbo-native-pinned", pinned);
		});

		this.container.querySelectorAll<HTMLElement>(".nav-folder").forEach((el) => {
			const titleEl = el.querySelector<HTMLElement>(".nav-folder-title");
			const path = titleEl?.dataset["path"] ?? "";
			const lastSlash = path.lastIndexOf("/");
			const name = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
			const shouldHide = nativeHidePatterns.some((rule) => matchesPattern(rule, name, path));
			el.toggleClass("turbo-hidden", shouldHide);
			const pinned = nativePinnedPaths.some((rule) => matchesPattern(rule, name, path));
			el.toggleClass("turbo-native-pinned", pinned);
		});
	}
}
