const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
const verboseLoggingEnabled = false;

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev && verboseLoggingEnabled) {
      console.log(...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
  debug: (...args: unknown[]) => {
    if (isDev && verboseLoggingEnabled) {
      console.debug(...args);
    }
  },
};
