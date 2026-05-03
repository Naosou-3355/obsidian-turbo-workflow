import { App } from "obsidian";

// Private adapter surface not in Obsidian's public types
interface PrivateAdapter {
	_exists(fullPath: string, path: string): Promise<boolean>;
	getFullPath(path: string): string;
	getRealPath(path: string): string;
	reconcileDeletion(realPath: string, path: string): Promise<void>;
	reconcileFileInternal?(realPath: string, path: string): Promise<void>;
	listRecursive(path: string): Promise<void>;
}

// Never expose these — corruption risk
const ALWAYS_EXCLUDED = new Set([".git", ".venv", ".hg", ".svn"]);

function isHiddenPath(path: string): boolean {
	return path.split("/").some((seg) => seg.startsWith(".") && !ALWAYS_EXCLUDED.has(seg));
}

export class HiddenFilesPatcher {
	private readonly hiddenPaths = new Set<string>();
	private originalReconcile: ((realPath: string, path: string) => Promise<void>) | null = null;
	private active = false;

	constructor(private readonly app: App) {}

	enable(): void {
		if (this.active) return;
		const adapter = this.getAdapter();
		if (!adapter) return;
		this.active = true;
		this.patchAdapter(adapter);
		// Trigger a full recursive listing to surface all hidden files into the vault index
		this.app.workspace.onLayoutReady(() => {
			adapter.listRecursive("").catch(() => {});
		});
	}

	disable(): void {
		if (!this.active) return;
		this.active = false;
		this.unpatchAdapter();
		void this.hideAll();
	}

	refresh(): void {
		if (!this.active) return;
		const adapter = this.getAdapter();
		if (adapter) adapter.listRecursive("").catch(() => {});
	}

	private patchAdapter(adapter: PrivateAdapter): void {
		const original = adapter.reconcileDeletion.bind(adapter);
		this.originalReconcile = original;

		adapter.reconcileDeletion = async (realPath: string, path: string): Promise<void> => {
			if (this.active && isHiddenPath(path)) {
				// Fast path: if the file is already in the vault index and we've previously
				// surfaced it, skip the async filesystem check + reconcile. This is what
				// fires repeatedly when the user clicks a hidden file (Obsidian's reload-
				// aware reconciler keeps trying to evict it), and the redundant filesystem
				// round-trips are what cause the open-flicker.
				if (this.hiddenPaths.has(path) && this.app.vault.getAbstractFileByPath(path)) {
					return;
				}
				const fullPath = adapter.getFullPath(path);
				const exists = await adapter._exists(fullPath, path).catch(() => false);
				if (exists) {
					this.hiddenPaths.add(path);
					await this.showFile(adapter, path).catch(() => {});
					return; // intercept — add to index instead of removing
				}
				this.hiddenPaths.delete(path);
			}
			return original(realPath, path);
		};
	}

	private unpatchAdapter(): void {
		const adapter = this.getAdapter();
		if (!adapter || !this.originalReconcile) return;
		adapter.reconcileDeletion = this.originalReconcile;
		this.originalReconcile = null;
	}

	private async showFile(adapter: PrivateAdapter, path: string): Promise<void> {
		if (!adapter.reconcileFileInternal) return;
		const realPath = adapter.getRealPath(path);
		await adapter.reconcileFileInternal(realPath, path);
	}

	private async hideAll(): Promise<void> {
		const adapter = this.getAdapter();
		if (!adapter) return;
		const paths = [...this.hiddenPaths];
		this.hiddenPaths.clear();
		for (const path of paths) {
			const realPath = adapter.getRealPath(path);
			await adapter.reconcileDeletion(realPath, path).catch(() => {});
		}
	}

	private getAdapter(): PrivateAdapter | null {
		const a = this.app.vault.adapter as unknown as PrivateAdapter;
		if (
			typeof a.reconcileDeletion !== "function" ||
			typeof a.getFullPath !== "function" ||
			typeof a.getRealPath !== "function" ||
			typeof a._exists !== "function"
		) {
			return null;
		}
		return a;
	}
}
