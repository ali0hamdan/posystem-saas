import { useEffect } from 'react';

/**
 * Injects `<meta name="robots" content="noindex,nofollow">` into the
 * document head for the lifetime of the calling component.
 *
 * The Super Admin dashboard must never end up in a search index — even if
 * a misconfigured deployment serves it on a guessable path, the meta tag
 * is a second line of defense against opportunistic discovery. Removed on
 * unmount so it doesn't bleed into client/public pages when the user
 * navigates away.
 *
 * Servers should ALSO set `X-Robots-Tag: noindex, nofollow` at the
 * reverse-proxy / API gateway for routes under the SaaS admin prefix —
 * the backend middleware in main.ts does this.
 */
export function useSaasNoindex() {
  useEffect(() => {
    // Some envs may already have a robots meta; preserve and restore it.
    const previous = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previousContent = previous?.getAttribute('content') ?? null;

    let meta = previous;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'noindex,nofollow');

    return () => {
      if (previousContent != null && meta) {
        meta.setAttribute('content', previousContent);
      } else if (meta && !previous) {
        meta.remove();
      }
    };
  }, []);
}
