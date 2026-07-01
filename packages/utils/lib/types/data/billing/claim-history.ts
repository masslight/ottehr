import { Coding } from 'fhir/r4b';
import { ottehrCodeSystemUrl, ottehrExtensionUrl, ottehrIdentifierSystem } from '../../../fhir/systemUrls';

// ---------------------------------------------------------------------------
// Claim change-history (Provenance) model
//
// Every create/mutation of a Claim or one of its working-copy resources writes
// a Provenance in the same FHIR transaction as the change. The Provenance is the
// attribution record (who, when, what activity); the field-level before/after is
// carried inline as a diff extension (see CLAIM_PROVENANCE_DIFF_EXTENSION_URL),
// backed by FHIR _history as the source of truth.
//
// Linkage: each Provenance simply targets the changed resource. Because billing
// working copies are created per-claim, the read side reconstructs a claim's full
// resource graph and queries Provenance?target=<id1>,<id2>,... to assemble history.
// ---------------------------------------------------------------------------

// Reuse the same activity-type system the lab / nursing-order Provenances use. Kept local
// (not exported) to avoid colliding with the labs constants' identically-named export.
const PROVENANCE_ACTIVITY_TYPE_SYSTEM = 'https://identifiers.fhir.oystehr.com/provenance-activity-type';

export const CLAIM_PROVENANCE_ACTIVITY_CODES = {
  create: 'CREATE',
  update: 'UPDATE',
  delete: 'DELETE',
  statusChange: 'STATUS CHANGE',
  tagChange: 'TAG CHANGE',
} as const;

export type ClaimProvenanceActivityKey = keyof typeof CLAIM_PROVENANCE_ACTIVITY_CODES;

const claimActivityCoding = (code: string, display: string): Coding => ({
  system: PROVENANCE_ACTIVITY_TYPE_SYSTEM,
  code,
  display,
});

export const CLAIM_PROVENANCE_ACTIVITY: Record<ClaimProvenanceActivityKey, Coding> = {
  create: claimActivityCoding(CLAIM_PROVENANCE_ACTIVITY_CODES.create, 'Create'),
  update: claimActivityCoding(CLAIM_PROVENANCE_ACTIVITY_CODES.update, 'Update'),
  delete: claimActivityCoding(CLAIM_PROVENANCE_ACTIVITY_CODES.delete, 'Delete'),
  statusChange: claimActivityCoding(CLAIM_PROVENANCE_ACTIVITY_CODES.statusChange, 'Status change'),
  tagChange: claimActivityCoding(CLAIM_PROVENANCE_ACTIVITY_CODES.tagChange, 'Tag change'),
};

// Distinguishes a human user from an automated software actor (e.g. the rules engine)
// without inspecting whether agent.who points at a Practitioner or a Device.
export const CLAIM_PROVENANCE_AGENT_TYPE_SYSTEM = ottehrCodeSystemUrl('claim-provenance-agent-type');

export const CLAIM_PROVENANCE_AGENT_TYPE: Record<'human' | 'system', Coding> = {
  human: { system: CLAIM_PROVENANCE_AGENT_TYPE_SYSTEM, code: 'human', display: 'User' },
  system: { system: CLAIM_PROVENANCE_AGENT_TYPE_SYSTEM, code: 'system', display: 'System' },
};

// Extension on the Provenance whose valueString holds a JSON-serialized ClaimProvenanceDiff.
export const CLAIM_PROVENANCE_DIFF_EXTENSION_URL = ottehrExtensionUrl('claim-history-change-set');

// Singleton Device representing the automated billing rules engine. The actor abstraction
// resolves (and lazily provisions) this Device so automated changes can be attributed to it;
// the rules engine itself is wired up separately.
export const CLAIM_RULES_ENGINE_DEVICE_IDENTIFIER = {
  system: ottehrIdentifierSystem('billing-rules-engine'),
  value: 'ottehr-rules-engine',
};
export const CLAIM_RULES_ENGINE_DEVICE_NAME = 'Ottehr Rules Engine';

// A single changed field, with the value before and after the change. Values are pre-formatted
// display strings (null = absent before/after, i.e. a set or a clear). Reference-typed fields
// (providers, facility) additionally carry a link to the resource's screen.
export interface ClaimFieldChange {
  // Machine-readable field key/path (e.g. 'memberId', 'diagnoses').
  field: string;
  // Human-readable label shown in the history view (e.g. 'Member ID').
  label: string;
  previousValue: string | null;
  newValue: string | null;
  // Deep-links for reference-typed values, set by the read API. Absent for plain-value fields.
  previousLink?: ClaimHistoryLink | null;
  newLink?: ClaimHistoryLink | null;
}

// A link from a history value to the billing-app screen that manages that resource. The UI builds
// the route as `/${screen}/${id}`.
export interface ClaimHistoryLink {
  screen: 'billing-providers' | 'rendering-providers' | 'service-facilities';
  id: string;
}

// Payload serialized into the Provenance diff extension. The changed resource's id is read from the
// Provenance.target reference (resolved server-side), so it is not duplicated here.
export interface ClaimProvenanceDiff {
  resourceType: string;
  changes: ClaimFieldChange[];
}

export interface ClaimHistoryActor {
  reference: string;
  display: string;
  type: 'user' | 'system';
}

// One row in the claim history view, assembled by get-billing-claim-history.
export interface ClaimHistoryEntry {
  id: string;
  recorded: string;
  // Human-readable activity label, e.g. 'Update Coverage'.
  activity: string;
  activityCode: string;
  resourceType: string;
  resourceId: string;
  actor: ClaimHistoryActor;
  changes: ClaimFieldChange[];
}

export interface GetClaimHistoryResponse {
  entries: ClaimHistoryEntry[];
}

// Friendly labels for the resource types that make up a claim, used to build the activity
// display string in the history view (e.g. 'Update Coverage', 'Update Service Facility').
export const CLAIM_HISTORY_RESOURCE_LABELS: Record<string, string> = {
  Claim: 'Claim',
  Patient: 'Patient',
  Coverage: 'Coverage',
  RelatedPerson: 'Policy Holder',
  Practitioner: 'Provider',
  Organization: 'Provider',
  Location: 'Service Facility',
};
