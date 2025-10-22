type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogEntry = {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: unknown;
};

type Listener = (entries: LogEntry[]) => void;

const LOG_STORAGE_KEY = 'trainer-console-debug-log';
const MAX_LOG_ENTRIES = 200;

const listeners = new Set<Listener>();

const isBrowser = typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';

const loadInitialEntries = (): LogEntry[] => {
  if (!isBrowser) return [];
  try {
    const raw = window.sessionStorage.getItem(LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LogEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (error) {
    console.warn('[Logger] Failed to parse persisted logs', error);
    return [];
  }
};

let entries: LogEntry[] = loadInitialEntries();

const persistEntries = () => {
  if (!isBrowser) return;
  try {
    window.sessionStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.warn('[Logger] Unable to persist logs', error);
  }
};

const notify = () => {
  listeners.forEach((listener) => listener(entries));
};

const appendEntry = (entry: LogEntry) => {
  entries = [...entries.slice(-MAX_LOG_ENTRIES + 1), entry];
  persistEntries();
  notify();
};

const createConsoleMethod = (level: LogLevel) => {
  const consoleMethod = level === 'debug' ? 'log' : level;
  return (message: string, context?: unknown) => {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      level,
      message,
      timestamp: new Date().toISOString(),
      context
    };

    if (context !== undefined) {
      (console as any)[consoleMethod](`[TrainerConsole] ${message}`, context);
    } else {
      (console as any)[consoleMethod](`[TrainerConsole] ${message}`);
    }

    appendEntry(entry);
  };
};

const debug = createConsoleMethod('debug');
const info = createConsoleMethod('info');
const warn = createConsoleMethod('warn');
const error = createConsoleMethod('error');

const subscribe = (listener: Listener) => {
  listeners.add(listener);
  listener(entries);
  return () => {
    listeners.delete(listener);
  };
};

const clear = () => {
  entries = [];
  persistEntries();
  notify();
};

const getEntries = () => entries;

export const logger = {
  debug,
  info,
  warn,
  error,
  subscribe,
  clear,
  getEntries
};

export type Logger = typeof logger;

export default logger;
