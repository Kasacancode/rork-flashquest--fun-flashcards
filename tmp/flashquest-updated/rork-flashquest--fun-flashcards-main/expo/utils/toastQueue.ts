import { logger } from '@/utils/logger';

type ToastRunner = () => void;

const toastQueue: ToastRunner[] = [];
let isToastActive = false;

function flushToastQueue() {
  if (isToastActive) {
    return;
  }

  const nextToast = toastQueue.shift();
  if (!nextToast) {
    return;
  }

  isToastActive = true;

  try {
    nextToast();
  } catch (error) {
    logger.warn('[ToastQueue] Failed to show toast:', error);
    isToastActive = false;
    setTimeout(flushToastQueue, 0);
  }
}

export function enqueueToastRunner(runner: ToastRunner) {
  toastQueue.push(runner);
  flushToastQueue();
}

export function releaseToastRunner() {
  isToastActive = false;
  flushToastQueue();
}
