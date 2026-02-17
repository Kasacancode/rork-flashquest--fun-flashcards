// Only log in development builds to keep production clean and performant
const isDev = __DEV__;

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) {
      console.log(...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },
  error: (...args: unknown[]) => {
    if (isDev) {
      console.error(...args);
    }
  },
  // Verbose logging for tracing execution paths during debugging
  debug: (...args: unknown[]) => {
    if (isDev) {
      console.debug(...args);
    }
  },
};
