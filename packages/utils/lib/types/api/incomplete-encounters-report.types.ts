import { z } from 'zod';

export type EncounterStatusFilter = 'incomplete' | 'complete' | 'all';

export interface IncompleteEncountersReportZambdaInput {
  dateRange: {
    start: string; // ISO date string
    end: string; // ISO date string
  };
  encounterStatus?: EncounterStatusFilter; // defaults to 'incomplete'
  // When true, also join each encounter's charted codes (ICD-10 diagnoses, CPT codes, E&M code).
  // Off by default — the extra FHIR includes are only worth it for consumers that need them
  // (ad-hoc reporting); the report pages don't.
  includeCodes?: boolean;
}

// The Zod schema is the single source of truth for this endpoint's response: it derives the TS
// types below and validates the zambda's output before it ships, so a mapper drift fails loud at
// the source instead of surfacing as a client-side parse error.
export const IncompleteEncounterItemSchema = z.object({
  appointmentId: z.string(),
  // FHIR Encounter id for this row. Unlike appointmentId this is unique per row — follow-up
  // encounters share their parent visit's appointmentId.
  encounterId: z.string().optional(),
  // 'main' for regular visits; follow-up encounters (SNOMED 390906007) are emitted as their own
  // rows in 'all' mode with their own dates. Absent outside 'all' mode.
  encounterType: z.enum(['main', 'follow-up', 'scheduled-follow-up']).optional(),
  patientId: z.string(),
  patientName: z.string(),
  dateOfBirth: z.string(),
  visitStatus: z.string(),
  appointmentStart: z.string(),
  appointmentEnd: z.string(),
  location: z.string().optional(),
  locationId: z.string().optional(),
  attendingProvider: z.string().optional(),
  visitType: z.string().optional(),
  reason: z.string().optional(),
  // Minutes the visit spent in "provider" status (time actually with the provider, from the
  // encounter's visit-status history). Excludes waiting room / intake. Only closed status periods
  // are counted; undefined when the visit never reached the provider or wasn't tracked.
  timeWithProviderMinutes: z.number().optional(),
  // Charted codes — present only when the request set includeCodes.
  // ICD-10 diagnosis codes on the encounter; the primary diagnosis (rank 1) is first when marked.
  icdCodes: z.array(z.string()).optional(),
  // CPT billing/procedure codes charted on the visit (excludes the E&M code).
  cptCodes: z.array(z.string()).optional(),
  // The visit's E&M code (e.g. 99213), if set.
  emCode: z.string().optional(),
});

export const IncompleteEncountersReportZambdaOutputSchema = z.object({
  message: z.string(),
  encounters: z.array(IncompleteEncounterItemSchema),
});

export type IncompleteEncounterItem = z.infer<typeof IncompleteEncounterItemSchema>;
export type IncompleteEncountersReportZambdaOutput = z.infer<typeof IncompleteEncountersReportZambdaOutputSchema>;
