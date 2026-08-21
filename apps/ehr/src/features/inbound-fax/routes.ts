/**
 * The match page for one inbound fax, keyed by the fax's Communication id.
 *
 * Everything that links to a fax goes through here (the Tasks queue action, the notification bell) so the
 * route stays defined in one place alongside the `<Route path>` it has to agree with in `App.tsx`.
 */
export const inboundFaxMatchPath = (faxCommunicationId: string): string => `/inbound-fax/${faxCommunicationId}/match`;
