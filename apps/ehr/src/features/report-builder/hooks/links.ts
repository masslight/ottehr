// SPA-side handling of the frame's openLink events. The SPA owns every URL template; the generated
// code only ever names a route + an id (or passes back an app-internal href a row carried), so a
// report can never emit an arbitrary URL.
import { AdHocLinkRoute, OpenLinkOptions } from 'utils';

// One template per route the contract defines — typed so a new route can't be added without one.
const ROUTE_TEMPLATES: Record<AdHocLinkRoute, string> = {
  patient: '/patient/{id}',
  visitNote: '/in-person/{id}',
  trackingBoard: '/visits',
} as const;

// App-internal path prefixes an `internal` href may target (rows carry ready-made hrefs like
// trackingBoardHref). Defense in depth: the frame content is untrusted, so the SPA re-validates.
const ALLOWED_INTERNAL_PREFIXES = ['/patient/', '/in-person/', '/telemed/', '/visits'];

/** The app-internal path for a validated openLink event, or undefined when it must be ignored. */
export function hrefForOpenLink(options: OpenLinkOptions): string | undefined {
  switch (options.type) {
    case 'patient':
    case 'visitNote': {
      const id = options.id.trim();
      return id ? ROUTE_TEMPLATES[options.type].replace('{id}', encodeURIComponent(id)) : undefined;
    }
    case 'trackingBoard':
      return ROUTE_TEMPLATES.trackingBoard;
    case 'internal': {
      const href = options.href;
      if (!href.startsWith('/') || href.startsWith('//')) return undefined;
      return ALLOWED_INTERNAL_PREFIXES.some((prefix) => href.startsWith(prefix)) ? href : undefined;
    }
  }
}
