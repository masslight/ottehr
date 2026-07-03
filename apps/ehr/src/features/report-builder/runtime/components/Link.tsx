import { Link as MuiLink } from '@mui/material';
import React from 'react';
import type { AdHocLinkRoute, OpenLinkOptions } from 'utils';
import { sendFrameEvent } from '../messaging';

export type LinkProps = {
  children: React.ReactNode;
} & (
  | {
      /** Open an EHR page by route + id. 'patient' needs patientId; 'visitNote' needs appointmentId. */
      route: Exclude<AdHocLinkRoute, 'trackingBoard'>;
      id: string | null | undefined;
      href?: never;
    }
  | { route: 'trackingBoard'; id?: never; href?: never }
  | {
      /** App-internal path carried on a row (e.g. trackingBoardHref). The SPA re-validates it. */
      href: string | null | undefined;
      route?: never;
      id?: never;
    }
);

const optionsFor = (props: LinkProps): OpenLinkOptions | null => {
  if ('href' in props && props.href) {
    return { type: 'internal', href: props.href };
  }
  if ('route' in props && props.route === 'trackingBoard') return { type: 'trackingBoard' };
  if ('route' in props && props.route && props.id) return { type: props.route, id: props.id };
  return null;
};

// The ONLY way a report reaches the rest of the app: clicking posts a whitelisted navigation EVENT
// (plain JSON) to the SPA, which validates it and opens the page in a new tab. No href leaves the
// frame as a URL; the SPA owns the URL template per route. When id/href is missing the children
// render as plain text — reports never produce dead links.
export function Link(props: LinkProps): React.ReactElement {
  const options = optionsFor(props);
  if (!options) return <>{props.children}</>;
  return (
    <MuiLink
      component="button"
      type="button"
      onClick={() => sendFrameEvent({ event: 'openLink', options })}
      sx={{ textDecoration: 'none', font: 'inherit', cursor: 'pointer' }}
    >
      {props.children}
    </MuiLink>
  );
}
