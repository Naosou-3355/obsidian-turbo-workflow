import { App, debounce } from "obsidian";
import TurboPlugin from "../main";
import { matchesPattern } from "../utils/pattern-match";

interface FileExplorerView {
	containerEl: HTMLElement | undefined;
}

export class NativeExplorerEnhancer {
	private observer: MutationObserver | null = null;
	private container: HTMLElement | null = null;
	private readonly debouncedApply: () => void;

	constructor(private app: App, private plugin: TurboPlugin) {
		this.debouncedApply = debounce(() => this.applyRules(), 80, true);
	}

	enable(): void {
		const leaves = this.app.workspace.getLeavesOfType("file-explorer");
		const leaf = leaves[0];
		if (!leaf) return;
		const view = leaf.view as unknown as FileExplorerView;
		if (!view.containerEl) return;
		this.container = view.containerEl;
		this.applyRules();
		this.observer = new MutationObserver((mutations) => {
			// Only react when actual nav-file/nav-folder elements are added — ignore
			// tooltips, hover indicators, and other transient mutations triggered by clicks
			if (this.hasRelevantMutation(mutations)) {
				this.debouncedApply();
			}
		});
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

	private hasRelevantMutation(mutations: MutationRecord[]): boolean {
		for (const m of mutations) {
			for (let i = 0; i < m.addedNodes.length; i++) {
				const node = m.addedNodes[i];
				if (!(node instanceof HTMLElement)) continue;
				if (node.matches(".nav-file, .nav-folder")) return true;
				if (node.querySelector(".nav-file, .nav-folder")) return true;
			}
		}
		return false;
	}

	private applyRules(): void {
		if (!this.container) return;
		this.observer?.disconnect();
		try {
			this.doApplyRules();
		} finally {
			if (this.container && this.observer) {
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
			if (!path) {
				el.removeClass("turbo-hidden");
				el.removeClass("turbo-native-pinned");
				return;
			}
			const lastSlash = path.lastIndexOf("/");
			const name = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
			const shouldHide = nativeHidePatterns.some((rule) => matchesPattern(rule, name, path));
			el.toggleClass("turbo-hidden", shouldHide);
			const pinned = nativePinnedPaths.some((rule) => matchesPattern(rule, name, path));
			el.toggleClass("turbo-native-pinned", pinned);
		});

		this.container.querySelectorAll<HTMLElement>(".nav-folder").forEach((el) => {
			const titleEl = el.querySelector<HTMLElement>(":scope > .nav-folder-title");
			const path = titleEl?.dataset["path"] ?? "";
			if (!path) {
				// Skip the explorer-root nav-folder which has no title/path
				el.removeClass("turbo-hidden");
				el.removeClass("turbo-native-pinned");
				return;
			}
			const lastSlash = path.lastIndexOf("/");
			const name = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
			const shouldHide = nativeHidePatterns.some((rule) => matchesPattern(rule, name, path));
			el.toggleClass("turbo-hidden", shouldHide);
			const pinned = nativePinnedPaths.some((rule) => matchesPattern(rule, name, path));
			el.toggleClass("turbo-native-pinned", pinned);
		});

		this.markPinnedDividers();
	}

	// For each container that holds direct nav children, find the first non-pinned
	// child in source order and tag it with `turbo-pinned-divider`. With CSS `order`
	// reordering, that element is rendered just below the pinned block — perfect spot
	// for a separator. The reorder is purely visual; vault paths are untouched.
	private markPinnedDividers(): void {
		if (!this.container) return;
		const containers = this.container.querySelectorAll<HTMLElement>(".nav-folder-children");
		containers.forEach((parent) => {
			const children = Array.from(parent.children) as HTMLElement[];
			let firstUnpinned: HTMLElement | null = null;
			let hasPinned = false;
			for (const c of children) {
				c.removeClass("turbo-pinned-divider");
				if (c.classList.contains("turbo-native-pinned")) {
					hasPinned = true;
				} else if (!firstUnpinned && !c.classList.contains("turbo-hidden")) {
					firstUnpinned = c;
				}
			}
			if (hasPinned && firstUnpinned) {
				firstUnpinned.addClass("turbo-pinned-divider");
			}
		});
	}
}
