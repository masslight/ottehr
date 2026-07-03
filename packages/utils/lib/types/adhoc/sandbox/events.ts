// The v1 message contract between the report iframe and the SPA: iframe → SPA only, one extensible
// shape { event, options } carrying plain JSON — never functions or code. The SPA keeps a whitelist
// of allowed events (this schema) and ignores everything else; later versions add new events (and
// SPA → iframe replies) by extending the union, the shape does not change.
import { z } from 'zod';

/** Routes a report link may target. The SPA owns the URL template per route; the generated code
 *  only ever names a route + an id, so a report cannot emit an arbitrary URL. */
export const ADHOC_LINK_ROUTES = ['patient', 'visitNote', 'trackingBoard'] as const;
export type AdHocLinkRoute = (typeof ADHOC_LINK_ROUTES)[number];

export const OpenLinkOptionsSchema = z.discriminatedUnion('type', [
  /** Open the patient chart. */
  z.object({ type: z.literal('patient'), id: z.string().min(1) }),
  /** Open the visit's note (review-and-sign) by appointment id. */
  z.object({ type: z.literal('visitNote'), id: z.string().min(1) }),
  /** Open the tracking board (static link). */
  z.object({ type: z.literal('trackingBoard') }),
  /** App-internal path carried on a row (e.g. the ready-made trackingBoardHref). The SPA
   *  re-validates it against its own allow-listed path prefixes before opening. */
  z.object({ type: z.literal('internal'), href: z.string().min(1) }),
]);
export type OpenLinkOptions = z.infer<typeof OpenLinkOptionsSchema>;

export const AdHocFrameEventSchema = z.discriminatedUnion('event', [
  z.object({ event: z.literal('openLink'), options: OpenLinkOptionsSchema }),
]);
export type AdHocFrameEvent = z.infer<typeof AdHocFrameEventSchema>;
