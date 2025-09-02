// Centralized Logger Service for KALE Pool Mining System
// Based on winston logger reference with exact implementation

import * as path from 'path';
import * as fs from 'fs';
import Config from '../config';

// Define log directories
const logsDir = path.join(process.cwd(), 'logs');
const archiveDir = path.join(logsDir, 'archive');

// Archive old logs when server starts
function archiveOldLogs() {
  // Create logs and archive directories if they don't exist
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }

  // Check if there are logs to archive
  const logFiles = ["error.log", "info.log", "combined.log"];
  const timestamp = getISTTimestamp().replace(/[:.]/g, "-");

  for (const logFile of logFiles) {
    const logPath = path.join(logsDir, logFile);

    // If log file exists, archive it
    if (fs.existsSync(logPath)) {
      try {
        const archivePath = path.join(archiveDir, `${timestamp}_${logFile}`);
        fs.copyFileSync(logPath, archivePath);
        fs.truncateSync(logPath, 0); // Clear the original file
        console.log(`Archived ${logFile} to ${archivePath}`);
      } catch (err) {
        console.error(`Failed to archive ${logFile}:`, err);
      }
    }
  }
}

// Archive logs on server start
archiveOldLogs();

// Helper function to get IST timestamp
function getISTTimestamp(): string {
  const now = new Date();
  const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000)); // Add 5.5 hours for IST
  return istTime.toISOString().replace('Z', '+05:30');
}

// Helper function to convert JS path to TS path
function convertJsToTsPath(jsPath: string): string {
  const projectRoot = process.cwd();

  // If it's already a TypeScript file, return as is
  if (jsPath.endsWith(".ts")) {
    return jsPath;
  }

  // Convert JS path to TS path
  let tsPath = jsPath;

  // Replace .js with .ts
  if (jsPath.endsWith(".js")) {
    tsPath = jsPath.replace(/\.js$/, ".ts");
  }

  // If the file is in dist or build directory, map it back to src
  if (tsPath.includes("/dist/") || tsPath.includes("/build/")) {
    tsPath = tsPath.replace(/\/dist\//, "/src/").replace(/\/build\//, "/src/");
  }

  // If it doesn't have src in path but is in project, assume it's in src
  if (tsPath.startsWith(projectRoot) && !tsPath.includes("/src/") && !tsPath.includes("node_modules")) {
    const relativePath = path.relative(projectRoot, tsPath);
    tsPath = path.join(projectRoot, "src", relativePath);
  }

  return tsPath;
}

// Helper function to get caller information (file, line, function)
function getCallerInfo() {
  const originalStackTraceLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = 20; // Increase stack trace limit

  const error = {} as Error;
  Error.captureStackTrace(error, getCallerInfo);

  const stackLines = error.stack?.split("\n").slice(1) || [];

  // Restore original stack trace limit
  Error.stackTraceLimit = originalStackTraceLimit;

  // Find the first line that is not from node_modules, internal, or our logger
  for (const line of stackLines) {
    // Extract filename and line number from the stack trace line
    const match = line.match(/\(([^:]+):(\d+):\d+\)/) || line.match(/at\s+([^:]+):(\d+):\d+/);

    if (match) {
      const [, file, lineNumber] = match;

      // Skip internal Node.js modules, winston modules, logform, readable-stream, and our logger
      if (
        file.includes("node_modules/winston") ||
        file.includes("node_modules/logform") ||
        file.includes("node_modules/readable-stream") ||
        file.includes("node_modules/@types") ||
        file.includes("internal/") ||
        file.includes("node:") ||
        file.includes("/logger/logger") ||
        file.includes("_stream_transform.js") ||
        file.includes("/utils/logger")
      ) {
        continue;
      }

      // Convert JS path to TS path
      const tsPath = convertJsToTsPath(file);

      return {
        file: tsPath,
        line: Number.parseInt(lineNumber, 10),
        function: line.match(/at\s+([^(]+)\s+\(/)
          ? line.match(/at\s+([^(]+)\s+\(/)?.[1]?.trim() || "anonymous"
          : "anonymous",
      };
    }
  }

  return {
    file: "unknown",
    line: 0,
    function: "anonymous",
  };
}

// Unified log entry interface for consistent structure
interface UnifiedLogEntry {
  timestamp: string;
  level: string;
  message: string;
  source: 'backend' | 'pooler';
  service?: string;
  
  // Backend metadata
  logpath?: string;
  file?: string;
  line?: number;
  function?: string;
}

// Custom logger class with service headers
class KaleLogger {
  private serviceName: string;
  
  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  private createLogEntry(level: string, message: string, context?: any): UnifiedLogEntry {
    // Get call stack information
    const stackInfo = getCallerInfo();

    const entry: UnifiedLogEntry = {
      timestamp: getISTTimestamp(),
      level: level,
      message: message,
      source: this.serviceName.includes('Pooler') ? 'pooler' : 'backend',
      service: this.serviceName
    };

    if (stackInfo && stackInfo.file !== "unknown") {
      // Extract the project-relative path from absolute path
      const projectPath = stackInfo.file.replace(process.cwd(), "");
      const relativePath = projectPath.startsWith("/") ? projectPath.substring(1) : projectPath;

      // Add file and line information to log
      entry.logpath = `${relativePath}:${stackInfo.line}`;
      entry.file = path.basename(stackInfo.file);
      entry.line = stackInfo.line;
      entry.function = stackInfo.function;
    } else {
      // Fallback values
      entry.logpath = "unknown:0";
      entry.file = "unknown";
      entry.line = 0;
      entry.function = "anonymous";
    }

    // Add context if provided
    if (context) {
      (entry as any).context = context;
    }

    return entry;
  }

  private writeToFile(entry: UnifiedLogEntry): void {
    try {
      // Write to service-specific log
      const serviceLogFile = path.join(logsDir, `${this.serviceName.toLowerCase().replace(/\s+/g, '-')}.log`);
      fs.appendFileSync(serviceLogFile, JSON.stringify(entry) + '\n');

      // Write to combined log
      const combinedFile = path.join(logsDir, 'combined.log');
      fs.appendFileSync(combinedFile, JSON.stringify(entry) + '\n');

      // Write to level-specific logs
      if (entry.level === 'error') {
        const errorFile = path.join(logsDir, 'error.log');
        fs.appendFileSync(errorFile, JSON.stringify(entry) + '\n');
      } else if (entry.level === 'info') {
        const infoFile = path.join(logsDir, 'info.log');
        fs.appendFileSync(infoFile, JSON.stringify(entry) + '\n');
      }
    } catch (error) {
      console.error('Logger file write failed:', error);
    }
  }

  private formatConsoleMessage(entry: UnifiedLogEntry): string {
    // Use shorter timestamp for console logs
    const timestamp = new Date(entry.timestamp).getTime().toString();
    const serviceIndicator = `[${this.serviceName}] [${entry.logpath}]`;
    const contextStr = (entry as any).context ? ` ${JSON.stringify((entry as any).context)}` : '';
    
    return `${timestamp} ${serviceIndicator} ${entry.level.toUpperCase()}: ${entry.message}${contextStr}`;
  }

  error(message: string, error?: Error, context?: any): void {
    const fullContext = { ...context };
    if (error) {
      fullContext.error = {
        message: error.message,
        name: error.name,
        stack: error.stack
      };
    }

    const entry = this.createLogEntry('error', message, fullContext);
    console.error(this.formatConsoleMessage(entry));
    this.writeToFile(entry);
  }

  warn(message: string, context?: any): void {
    const entry = this.createLogEntry('warn', message, context);
    console.warn(this.formatConsoleMessage(entry));
    this.writeToFile(entry);
  }

  info(message: string, context?: any): void {
    const entry = this.createLogEntry('info', message, context);
    console.log(this.formatConsoleMessage(entry));
    this.writeToFile(entry);
  }

  debug(message: string, context?: any): void {
    if (Config.LOG_LEVEL === 'debug') {
      const entry = this.createLogEntry('debug', message, context);
      console.debug(this.formatConsoleMessage(entry));
      this.writeToFile(entry);
    }
  }
}

// Factory function to create logger instances for different services
export function createLogger(serviceName: string): KaleLogger {
  return new KaleLogger(serviceName);
}

// Pre-configured loggers for common services
export const backendLogger = createLogger('Backend API');
export const poolerLogger = createLogger('Pooler Service');
export const walletLogger = createLogger('Wallet Manager');
export const launchtubeLogger = createLogger('Launchtube Service');
export const databaseLogger = createLogger('Database Service');
export const blockMonitorLogger = createLogger('Block Monitor');