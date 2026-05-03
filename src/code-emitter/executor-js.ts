import { CODE_EMITTER_TIMEOUT_MS } from "../utils/constants";

const WORKER_SOURCE = `
self.onmessage = function(e) {
  var code = e.data.code;
  var logs = [];
  var origLog = console.log;
  var origWarn = console.warn;
  var origError = console.error;
  console.log = function() { logs.push({ type: 'log', text: Array.prototype.join.call(arguments, ' ') }); };
  console.warn = function() { logs.push({ type: 'warn', text: Array.prototype.join.call(arguments, ' ') }); };
  console.error = function() { logs.push({ type: 'error', text: Array.prototype.join.call(arguments, ' ') }); };
  try {
    (new Function(code))();
    self.postMessage({ ok: true, logs: logs });
  } catch(err) {
    self.postMessage({ ok: false, error: String(err), logs: logs });
  } finally {
    console.log = origLog;
    console.warn = origWarn;
    console.error = origError;
  }
};
`;

interface WorkerMessage {
	ok: boolean;
	logs: Array<{ type: string; text: string }>;
	error?: string;
}

export async function executeJs(code: string): Promise<{ output: string; error?: string }> {
	return new Promise((resolve) => {
		const blob = new Blob([WORKER_SOURCE], { type: "application/javascript" });
		const url = URL.createObjectURL(blob);
		const worker = new Worker(url);

		const timeout = setTimeout(() => {
			worker.terminate();
			URL.revokeObjectURL(url);
			resolve({ output: "", error: "Execution timed out after " + (CODE_EMITTER_TIMEOUT_MS / 1000) + "s" });
		}, CODE_EMITTER_TIMEOUT_MS);

		worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
			clearTimeout(timeout);
			worker.terminate();
			URL.revokeObjectURL(url);
			const { ok, logs, error } = e.data;
			const output = logs.map((l) => l.text).join("\n");
			resolve({ output, error: ok ? undefined : error });
		};

		worker.onerror = (e: ErrorEvent) => {
			clearTimeout(timeout);
			worker.terminate();
			URL.revokeObjectURL(url);
			resolve({ output: "", error: e.message });
		};

		worker.postMessage({ code });
	});
}
