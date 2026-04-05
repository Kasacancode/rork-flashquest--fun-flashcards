export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }) {
  void initial;

  try {
    const url = new URL(path, 'https://flashquest.net');
    const pathFromExpo = url.pathname.startsWith('/--/') ? url.pathname.slice(3) : null;
    const pathname = pathFromExpo ?? url.pathname;
    const normalizedPathname = url.hostname ? `/${url.hostname}${pathname}`.replace(/\/+/g, '/') : pathname;
    const suffix = `${url.search}${url.hash}`;

    if (
      pathname === '/join'
      || pathname === 'join'
      || pathname === '/join.html'
      || pathname === 'join.html'
      || normalizedPathname === '/join'
      || normalizedPathname === 'join'
      || normalizedPathname.startsWith('/arena/join')
      || normalizedPathname.startsWith('arena/join')
    ) {
      const code = url.searchParams.get('code') || '';
      if (code) {
        return `/arena?joinCode=${encodeURIComponent(code.toUpperCase().slice(0, 8))}`;
      }
      return '/arena';
    }

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
