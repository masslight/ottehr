// Single source of truth for the synthetic-data tag/identifier systems and the
// visit-status lifecycle constants shared by the harness, the daily census, and
// the cleanup scripts.
//
// Where a value is owned by Ottehr (the visit-status extension URL, the status
// vocabulary) we IMPORT it from `utils` rather than copy it, so a change upstream
// propagates here instead of silently drifting. The synthetic-data tag/identifier
// systems below are owned by THIS pipeline, so they're defined here.
import { FHIR_EXTENSION, visitStatusArray } from 'utils';

/** Patient.identifier system marking a synthetic patient (idempotent reuse + cleanup scope). */
export const SYNTHETIC_PATIENT_ID_SYSTEM = 'https://fhir.ottehr.com/sid/synthetic-patient-id';

/** meta.tag system marking daily-census data (code below). */
export const SYNTH_CRON_SYSTEM = 'https://fhir.ottehr.com/sid/synth-cron';
export const SYNTH_CRON_CODE = 'synth-cron';

/** meta.tag system carrying the census run date (tag value = YYYY-MM-DD). */
export const SYNTH_CRON_RUN_DATE_SYSTEM = 'https://fhir.ottehr.com/sid/synth-cron-run-date';

/**
 * Encounter.statusHistory extension carrying the Ottehr visit-status code.
 * Imported from utils — writing a different URL makes the EHR fall through to a
 * legacy renderer that emits garbage durations, so this must stay in lockstep.
 */
export const OTTEHR_VISIT_STATUS_EXTENSION_URL = FHIR_EXTENSION.EncounterStatusHistory.ottehrVisitStatus.url;

/**
 * Ottehr in-person visit-status lifecycle, in forward-walk order. This is the
 * subset of utils' canonical `visitStatusArray` that the harness walks (it omits
 * the terminal / non-forward states: cancelled, no show, awaiting supervisor
 * approval, unknown). Kept as an explicit literal for the precise tuple type; the
 * drift guard below fails loudly at load if any entry no longer exists upstream.
 */
export const VISIT_STATUS_ORDER = [
  'pending',
  'arrived',
  'ready',
  'intake',
  'ready for provider',
  'provider',
  'discharged',
  'completed',
] as const;

export type VisitStatus = (typeof VISIT_STATUS_ORDER)[number];

// Drift guard: if utils renames/removes a status, fail here instead of silently
// walking a stale lifecycle (tsx strips types, so this is a runtime check).
for (const s of VISIT_STATUS_ORDER) {
  if (!(visitStatusArray as readonly string[]).includes(s)) {
    throw new Error(
      `VISIT_STATUS_ORDER "${s}" is no longer in utils' visitStatusArray — ` +
        `the synth status lifecycle has drifted from Ottehr. Reconcile shared/constants.ts.`
    );
  }
}

export interface StatusGapMinutes {
  min: number;
  max: number;
}

// Realistic urgent-care timing distributions (minutes), used to backdate
// Encounter.statusHistory so completed visits show plausible length-of-stay.
// Ranges span the "fast visit" (~30 min total) to "slow visit" (~2 hr total).
// 'arrived' is relative to appointment.start (-5 = arrived 5 min early; +20 = ran late).
export const STATUS_GAP_DISTRIBUTIONS: Record<string, StatusGapMinutes> = {
  arrived: { min: -5, max: 20 },
  ready: { min: 1, max: 8 }, // front desk identifies the patient + chart update
  intake: { min: 5, max: 25 }, // waiting for an intake nurse to call them back
  'ready for provider': { min: 8, max: 15 }, // vitals + chief complaint + paperwork
  provider: { min: 3, max: 30 }, // waiting for provider (longest variance)
  discharged: { min: 12, max: 35 }, // the actual visit
  completed: { min: 2, max: 15 }, // paperwork wrap-up + room cleanup
};
