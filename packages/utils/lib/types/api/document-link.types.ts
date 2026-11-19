import { z } from 'zod';

/** Lifetime of an emailed document link. */
export const DOCUMENT_LINK_TTL_MINUTES = 60;
/** The same lifetime as a `jose` duration string. */
export const DOCUMENT_LINK_TTL = `${DOCUMENT_LINK_TTL_MINUTES}m`;
/** JWT audience of an emailed document link token. */
export const DOCUMENT_LINK_AUDIENCE = 'document-link';

export const OpenDocumentLinkInputSchema = z.object({
  token: z.string().min(1).max(2048),
});
export type OpenDocumentLinkInput = z.infer<typeof OpenDocumentLinkInputSchema>;

/**
 * `ok` carries a short-lived download URL. `expired` with `resent` means a fresh link was just emailed to the
 * recorded recipient; without it, the newest link for this send is still live and was sent at `sentAt`.
 */
export type OpenDocumentLinkOutput =
  | { status: 'ok'; url: string; title?: string }
  | { status: 'expired'; resent: true }
  | { status: 'expired'; resent: false; sentAt: string };
