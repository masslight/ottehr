import { Coding } from 'fhir/r4b';
import { ottehrCodeSystemUrl, ottehrExtensionUrl, ottehrIdentifierSystem } from '../../../fhir/systemUrls';
import { PROVENANCE_ACTIVITY_TYPE_SYSTEM } from '../labs/labs.constants';

// Types and codings for billing-claim change history. The design overview (how Provenances are
// written and queried) lives in packages/zambdas/src/billing/provenance.ts.

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

// Extension on the Provenance whose valueString holds a JSON-serialized ClaimFieldChange[].
export const CLAIM_PROVENANCE_DIFF_EXTENSION_URL = ottehrExtensionUrl('claim-history-change-set');

// Singleton Device representing the automated billing rules engine. The actor abstraction
// resolves (and lazily provisions) this Device so automated changes can be attributed to it;
// the rules engine itself is wired up separately.
export const CLAIM_RULES_ENGINE_DEVICE_IDENTIFIER = {
  system: ottehrIdentifierSystem('billing-rules-engine'),
  value: 'ottehr-rules-engine',
};
export const CLAIM_RULES_ENGINE_DEVICE_NAME = 'Ottehr Rules Engine';

// Singleton Device representing general automated system activity that is not specifically
// attributable to the rules engine.
export const CLAIM_SYSTEM_DEVICE_IDENTIFIER = {
  system: ottehrIdentifierSystem('billing-system'),
  value: 'ottehr-system',
};
export const CLAIM_SYSTEM_DEVICE_NAME = 'Ottehr System';

// A single changed field, with the value before and after the change. Values are display strings
// captured at write time (null = absent, i.e. a set or a clear). For reference-typed fields
// (providers, facility, payer) the raw FHIR reference is kept alongside in previousRef/newRef;
// change detection compares refs when present, so display-only differences are not changes.
export interface ClaimFieldChange {
  // Machine-readable field key/path (e.g. 'memberId', 'diagnoses').
  field: string;
  // Human-readable label shown in the history view (e.g. 'Member ID').
  label: string;
  previousValue: string | null;
  newValue: string | null;
  previousRef?: string;
  newRef?: string;
  // Deep-links to the screens managing referenced resources — populated by the read API only,
  // never stored.
  previousLink?: ClaimHistoryLink | null;
  newLink?: ClaimHistoryLink | null;
}

// A link from a history value to the billing-app screen that manages that resource. The UI builds
// the route as `/${screen}/${id}`.
export interface ClaimHistoryLink {
  screen: 'billing-providers' | 'rendering-providers' | 'service-facilities';
  id: string;
}

export interface ClaimHistoryActor {
  display: string;
  type: 'user' | 'system';
}

// One row in the claim history view, assembled by get-billing-claim-history.
export interface ClaimHistoryEntry {
  id: string;
  recorded: string;
  // Human-readable activity label, e.g. 'Update Coverage'.
  activity: string;
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
  Practitioner: 'Provider',
  Organization: 'Provider',
  Location: 'Service Facility',
};
