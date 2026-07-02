import Oystehr from '@oystehr/sdk';
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
