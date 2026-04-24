const DEBUG = import.meta.env.DEV;

export function debugLog(...args: unknown[]): void {
  if (DEBUG) {
    console.log(...args);
  }
}

export function debugError(...args: unknown[]): void {
  if (DEBUG) {
    console.error(...args);
  }
}

export function debugWarn(...args: unknown[]): void {
  if (DEBUG) {
    console.warn(...args);
  }
}
