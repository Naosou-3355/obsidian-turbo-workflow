import { HideRule, PinRule } from "../types";

export function matchesPattern(rule: HideRule | PinRule, name: string, path: string): boolean {
	const subject = rule.scope === "name" ? name : path;
	if (rule.type === "glob") return globToRegex(rule.pattern).test(subject);
	try {
		return new RegExp(rule.pattern, "i").test(subject);
	} catch {
		return false;
	}
}

function globToRegex(glob: string): RegExp {
	const escaped = glob
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		.replace(/\*/g, ".*")
		.replace(/\?/g, ".");
	return new RegExp(`^${escaped}$`, "i");
}
