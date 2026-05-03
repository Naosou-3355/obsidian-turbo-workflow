import { MarkdownPostProcessorContext } from "obsidian";
import TurboPlugin from "../main";
import { CODE_EMITTER_SUPPORTED_LANGS, CODE_EMITTER_REMOTE_LANGS } from "../utils/constants";
import { executeJs } from "./executor-js";
import { executePython } from "./executor-python";
import { executeHtml } from "./executor-html";
import { executeRust } from "./executor-remote";

export function registerCodeEmitter(plugin: TurboPlugin): void {
	plugin.registerMarkdownPostProcessor(
		(el: HTMLElement, _ctx: MarkdownPostProcessorContext) => {
			if (!plugin.settings.codeEmitterEnabled) return;
			processCodeBlocks(el, plugin);
		},
	);
}

function processCodeBlocks(el: HTMLElement, plugin: TurboPlugin): void {
	const codeEls = el.querySelectorAll<HTMLElement>("pre > code");
	codeEls.forEach((codeEl) => {
		const lang = getLang(codeEl);
		if (!lang) return;
		const isSupported = CODE_EMITTER_SUPPORTED_LANGS.indexOf(lang) >= 0;
		const isRemote = CODE_EMITTER_REMOTE_LANGS.indexOf(lang) >= 0;
		if (!isSupported && !isRemote) return;
		if (isRemote && !plugin.settings.codeEmitterRemoteEnabled) return;

		const pre = codeEl.closest("pre") as HTMLElement | null;
		if (!pre || pre.dataset["codeEmitterAttached"]) return;
		pre.dataset["codeEmitterAttached"] = "1";

		const code = codeEl.textContent ?? "";
		addRunButton(pre, lang, code, plugin);
	});
}

function getLang(codeEl: HTMLElement): string | null {
	const classes = codeEl.className.split(/\s+/);
	for (const cls of classes) {
		if (cls.startsWith("language-")) return cls.slice(9).toLowerCase();
	}
	return null;
}

function addRunButton(pre: HTMLElement, lang: string, code: string, plugin: TurboPlugin): void {
	const btn = document.createElement("button");
	btn.className = "code-emitter-run";
	btn.textContent = "Run";

	const output = document.createElement("div");
	output.className = "code-emitter-output";

	pre.insertAdjacentElement("afterend", output);
	pre.insertAdjacentElement("afterend", btn);

	btn.addEventListener("click", () => {
		void runCode(lang, code, output, plugin);
	});
}

async function runCode(
	lang: string,
	code: string,
	output: HTMLElement,
	_plugin: TurboPlugin,
): Promise<void> {
	output.empty();
	output.addClass("is-running");
	output.textContent = "Running…";

	try {
		if (lang === "html" || lang === "css") {
			executeHtml(output, code, lang);
			output.removeClass("is-running");
			return;
		}

		let result: { output: string; error?: string };
		if (lang === "js" || lang === "javascript" || lang === "ts" || lang === "typescript") {
			result = await executeJs(code);
		} else if (lang === "py" || lang === "python") {
			result = await executePython(code);
		} else if (lang === "rust") {
			result = await executeRust(code);
		} else {
			result = { output: "", error: `Language "${lang}" is not supported` };
		}

		output.removeClass("is-running");
		output.empty();

		if (result.output) {
			const pre = output.createEl("pre", { cls: "code-emitter-result" });
			pre.textContent = result.output;
		}
		if (result.error) {
			output.createDiv({ cls: "code-emitter-error", text: result.error });
		}
		if (!result.output && !result.error) {
			output.createDiv({ cls: "code-emitter-empty", text: "(no output)" });
		}
	} catch (err) {
		output.removeClass("is-running");
		output.empty();
		output.createDiv({ cls: "code-emitter-error", text: String(err) });
	}
}
