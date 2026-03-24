export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }) {
  void initial;

  try {
    const url = new URL(path, 'https://flashquest.net');
    const pathFromExpo = url.pathname.startsWith('/--/') ? url.pathname.slice(3) : null;
    const pathname = pathFromExpo ?? url.pathname;
    const suffix = `${url.search}${url.hash}`;

    if (pathFromExpo) {
      return `${pathname}${suffix}` || '/';
    }

    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return `${pathname}${suffix}` || '/';
    }

    if (url.hostname) {
      return `/${url.hostname}${pathname}${suffix}`.replace(/\/+/g, '/');
    }

    return `${pathname}${suffix}` || '/';
  } catch {
    if (!path) {
      return '/';
    }

    return path.startsWith('/') ? path : `/${path}`;
  }
}
