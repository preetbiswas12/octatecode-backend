export enum LogLevel {
	DEBUG = 'DEBUG',
	INFO = 'INFO',
	WARN = 'WARN',
	ERROR = 'ERROR'
}

export class Logger {
	private static instance: Logger;
	private logLevel: LogLevel = LogLevel.INFO;

	private constructor() { }

	static getInstance(): Logger {
		if (!Logger.instance) {
			Logger.instance = new Logger();
		}
		return Logger.instance;
	}

	setLogLevel(level: LogLevel): void {
		this.logLevel = level;
	}

	private shouldLog(level: LogLevel): boolean {
		const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
		return levels.indexOf(level) >= levels.indexOf(this.logLevel);
	}

	private formatTime(): string {
		return new Date().toISOString();
	}

	debug(message: string, data?: any): void {
		if (this.shouldLog(LogLevel.DEBUG)) {
			console.log(`[${this.formatTime()}] [DEBUG] ${message}`, data || '');
		}
	}

	info(message: string, data?: any): void {
		if (this.shouldLog(LogLevel.INFO)) {
			console.log(`[${this.formatTime()}] [INFO] ${message}`, data || '');
		}
	}

	warn(message: string, data?: any): void {
		if (this.shouldLog(LogLevel.WARN)) {
			console.warn(`[${this.formatTime()}] [WARN] ${message}`, data || '');
		}
	}

	error(message: string, error?: any): void {
		if (this.shouldLog(LogLevel.ERROR)) {
			console.error(`[${this.formatTime()}] [ERROR] ${message}`, error || '');
		}
	}
}

export default Logger.getInstance();
