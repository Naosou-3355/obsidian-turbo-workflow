interface PyodideInterface {
	runPythonAsync(code: string): Promise<unknown>;
}

interface PyodideGlobal {
	loadPyodide(): Promise<PyodideInterface>;
}

let pyodideInstance: PyodideInterface | null = null;
let loadingPromise: Promise<PyodideInterface> | null = null;

const PYODIDE_CDN = "https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.js";

async function loadPyodide(): Promise<PyodideInterface> {
	if (pyodideInstance) return pyodideInstance;
	if (loadingPromise) return loadingPromise;

	loadingPromise = new Promise<PyodideInterface>((resolve, reject) => {
		const script = document.createElement("script");
		script.src = PYODIDE_CDN;
		script.onload = () => {
			const g = globalThis as unknown as PyodideGlobal;
			g.loadPyodide()
				.then((py) => {
					pyodideInstance = py;
					resolve(py);
				})
				.catch(reject);
		};
		script.onerror = () => reject(new Error("Failed to load Pyodide from CDN"));
		document.head.appendChild(script);
	}).catch((err: unknown) => {
		// Clear on failure so the next call can retry
		loadingPromise = null;
		throw err;
	});

	return loadingPromise;
}

export async function executePython(code: string): Promise<{ output: string; error?: string }> {
	try {
		const py = await loadPyodide();
		const captureCode = `
import sys, io as _io
_buf = _io.StringIO()
_prev = sys.stdout
sys.stdout = _buf
try:
    exec(${JSON.stringify(code)})
except Exception as _e:
    sys.stdout.write(str(_e))
finally:
    sys.stdout = _prev
_buf.getvalue()
`;
		const result = await py.runPythonAsync(captureCode);
		const output = typeof result === "string" ? result : "";
		return { output };
	} catch (err) {
		return { output: "", error: String(err) };
	}
}
