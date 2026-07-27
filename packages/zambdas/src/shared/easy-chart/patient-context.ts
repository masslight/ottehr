import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { Encounter, Patient } from 'fhir/r4b';

// Build the PATIENT block content from the chart, e.g. "name Jane Doe, age 7 years (DOB
// 2019-02-14), sex female". The narrative is often an ambient recording containing cross-talk
// about OTHER people (a parent's other child, hallway conversation), so the note's identity and
// demographics must come from the verified Patient, never be inferred from the transcript. Shared
// by the planner and the review so both anchor on the same identity.
export async function fetchPatientContext(oystehr: Oystehr, encounterId: string): Promise<string | undefined> {
  const encounter = await oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: encounterId });
  const patientId = encounter.subject?.reference?.replace('Patient/', '');
  if (!patientId) return undefined;
  const patient = await oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId });
  const parts: string[] = [];
  const name = patient.name?.[0];
  const fullName = [name?.given?.[0], name?.family].filter(Boolean).join(' ');
  if (fullName) parts.push(`name ${fullName}`);
  if (patient.birthDate) {
    const ageYears = Math.floor((Date.now() - new Date(patient.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000));
    parts.push(`age ${ageYears} ${ageYears === 1 ? 'year' : 'years'} (DOB ${patient.birthDate})`);
  }
  if (patient.gender) parts.push(`sex ${patient.gender}`);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

// NEW vs ESTABLISHED patient per the E&M definition: "new" = no professional services in the past
// 3 years. Derived from the FHIR history: any FINISHED Encounter for the same patient that ENDED
// before this encounter began, within the 3-year lookback → 'established'; none → 'new'.
// Best-effort by contract: ANY failure returns undefined (never throws) so the calling zambda
// proceeds without a status — the prompts treat unknown as established, the no-regression default.
// Shared by the planner and the review so both pick the same E&M code family.
export async function derivePatientStatus(
  oystehr: Oystehr,
  encounterId: string
): Promise<'new' | 'established' | undefined> {
  try {
    const encounter = await oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: encounterId });
    const patientId = encounter.subject?.reference?.replace('Patient/', '');
    if (!patientId) return undefined;
    const startMs = encounter.period?.start ? new Date(encounter.period.start).getTime() : Date.now();
    if (isNaN(startMs)) return undefined;
    const lookbackMs = startMs - 3 * 365.25 * 24 * 3600 * 1000;
    // Server-side narrowing only (date matches the Encounter period loosely across FHIR prefix
    // semantics); the authoritative ended-before-start + lookback check is applied in code below.
    const prior = (
      await oystehr.fhir.search<Encounter>({
        resourceType: 'Encounter',
        params: [
          { name: 'subject', value: `Patient/${patientId}` },
          { name: 'status', value: 'finished' },
          { name: 'date', value: `ge${new Date(lookbackMs).toISOString()}` },
          { name: 'date', value: `lt${new Date(startMs).toISOString()}` },
          { name: '_count', value: '100' },
        ],
      })
    ).unbundle();
    const hasPrior = prior.some((e) => {
      if (e.id === encounterId) return false;
      const end = e.period?.end ?? e.period?.start;
      if (!end) return false;
      const endMs = new Date(end).getTime();
      return !isNaN(endMs) && endMs < startMs && endMs >= lookbackMs;
    });
    return hasPrior ? 'established' : 'new';
  } catch (e) {
    console.warn('derivePatientStatus failed, proceeding without patient status:', e);
    captureException(e);
    return undefined;
  }
}
