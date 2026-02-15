const PREFIX = '[Praxis]';

export const logger = {
  log(...args: unknown[]): void {
    if (__DEV__) console.log(PREFIX, ...args);
  },
  warn(...args: unknown[]): void {
    if (__DEV__) console.warn(PREFIX, ...args);
  },
  error(...args: unknown[]): void {
    if (__DEV__) console.error(PREFIX, ...args);
  },
  group(label: string): void {
    if (__DEV__) console.group(`${PREFIX} ${label}`);
  },
  groupEnd(): void {
    if (__DEV__) console.groupEnd();
  },
};
