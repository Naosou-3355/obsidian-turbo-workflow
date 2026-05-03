export function executeHtml(container: HTMLElement, code: string, lang: string): void {
	container.empty();
	const wrapper = container.createDiv({ cls: "code-emitter-html-output" });
	const shadow = wrapper.attachShadow({ mode: "open" });

	if (lang === "css") {
		shadow.innerHTML = `<style>${code}</style><div class="preview-target"><p>CSS preview element</p><a href="#">Link</a><button>Button</button></div>`;
	} else {
		// Strip script tags before rendering — scripts in Electron's renderer have Node.js
		// access, making arbitrary script execution a security risk.
		const parser = new DOMParser();
		const doc = parser.parseFromString(code, "text/html");
		doc.querySelectorAll("script").forEach((s) => s.remove());
		shadow.innerHTML = doc.body.innerHTML;
	}
}
