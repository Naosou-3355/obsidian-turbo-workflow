import { requestUrl } from "obsidian";

interface RustPlaygroundResponse {
	success: boolean;
	stdout: string;
	stderr: string;
}

export async function executeRust(code: string): Promise<{ output: string; error?: string }> {
	const payload = {
		channel: "stable",
		mode: "debug",
		edition: "2021",
		crateType: "bin",
		tests: false,
		code,
		backtrace: false,
	};
	try {
		const resp = await requestUrl({
			url: "https://play.rust-lang.org/execute",
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		const data = resp.json as RustPlaygroundResponse;
		if (data.success) {
			return { output: data.stdout };
		}
		return { output: data.stdout, error: data.stderr };
	} catch (err) {
		return { output: "", error: String(err) };
	}
}
