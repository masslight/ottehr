// Shared billing FHIR system constants.
//
// A user- or system-defined billing tag is applied to a Claim as a meta.tag of the form
// `{ system: CLAIM_TAG_SYSTEM, code: <tag name> }` (the tag's display name is the code). The tag
// *definition* is a Basic resource (see save-billing-tag), but the applied tag on a claim only
// carries the name.
//
// This lives in `utils` (rather than the zambdas billing/shared.ts where it originated) so that the
// rules-engine code shared across the zambdas and the billing app can read and write claim tags from
// a single source of truth. `packages/zambdas/src/billing/shared.ts` re-exports it for the existing
// billing-zambda imports.
export const CLAIM_TAG_SYSTEM = 'https://fhir.ottehr.com/billing/claim-tag';
