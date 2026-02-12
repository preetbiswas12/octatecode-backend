/// <reference lib="dom" />
/// <reference lib="es2020" />

declare global {
	namespace NodeJS {
		interface ProcessEnv {
			PORT?: string;
			SIGNALING_PORT?: string;
			NODE_ENV?: string;
		}
	}

	var process: NodeJS.Process;
	var console: Console;
}

export {};
