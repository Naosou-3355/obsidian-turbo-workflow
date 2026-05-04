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
	// Tracks paths whose `showFile` is in flight. Prevents duplicate concurrent
	// `reconcileFileInternal` calls for the same path when Obsidian fires its
	// reconciler multiple times before our first one finishes.
	private readonly inFlight = new Set<string>();
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

		// NOTE: kept as a non-async function so the synchronous fast path returns an
		// already-resolved Promise without an extra microtask hop. Obsidian awaits
		// this method on hot paths (file open, scroll-driven re-reconciliation), and
		// every microtask we add stacks into the visible click-to-content latency.
		adapter.reconcileDeletion = (realPath: string, path: string): Promise<void> => {
			if (!this.active || !isHiddenPath(path)) {
				return original(realPath, path);
			}
			// Fast synchronous path: file is already in the vault index → keep it.
			// The vault is the source of truth; the cache Set is bookkeeping for
			// disable-time cleanup only.
			if (this.app.vault.getAbstractFileByPath(path)) {
				this.hiddenPaths.add(path);
				return Promise.resolve();
			}
			// Coalesce concurrent first-time shows for the same path.
			if (this.inFlight.has(path)) {
				return Promise.resolve();
			}
			return this.surface(adapter, original, realPath, path);
		};
	}

	private async surface(
		adapter: PrivateAdapter,
		original: (realPath: string, path: string) => Promise<void>,
		realPath: string,
		path: string,
	): Promise<void> {
		this.inFlight.add(path);
		try {
			const fullPath = adapter.getFullPath(path);
			const exists = await adapter._exists(fullPath, path).catch(() => false);
			if (exists) {
				this.hiddenPaths.add(path);
				await this.showFile(adapter, path).catch(() => {});
				return;
			}
			this.hiddenPaths.delete(path);
			return original(realPath, path);
		} finally {
			this.inFlight.delete(path);
		}
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
